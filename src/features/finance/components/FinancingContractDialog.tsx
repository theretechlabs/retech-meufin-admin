import { useEffect } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { DecimalField } from '@/components/fields/DecimalField'
import { MoneyField } from '@/components/fields/MoneyField'
import { ErrorState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import {
  createFinancing,
  formatCents,
  listAccounts,
  reaisToCents,
  updateFinancing,
  type AssetType,
  type FinancingContract,
  type FinancingTerms,
} from '../api'
import { errorMessage, financeKeys } from '../constants'
import {
  centsToFieldText,
  financingSchedule,
  formatDateBR,
  optionalCents,
  percentTextToPPM,
  ppmToPercentText,
  RATE_DECIMALS,
  suggestInstallmentNumber,
} from '../financing'
import { todayISO } from '../installments'
import { SupplierField } from './SupplierField'

type FormValues = {
  description: string
  supplier_id: string
  contract_number: string
  purchase_date: string
  financed: string
  down_payment: string
  term_months: string
  nominal_rate: string
  effective_rate: string
  effective_relationship_rate: string
  installment: string
  reference_date: string
  reference_installment: string
  settle_past: boolean
  balance: string
  balance_date: string
  auto_debit: boolean
  auto_debit_account_id: string
  notes: string
}

function formDefaults(
  contract: FinancingContract | undefined,
  assetName: string,
  purchaseDate?: string | null,
): FormValues {
  return {
    description: contract?.description ?? `Financiamento ${assetName}`,
    supplier_id: contract?.supplier_id ?? '',
    contract_number: contract?.contract_number ?? '',
    purchase_date: contract?.purchase_date ?? purchaseDate ?? '',
    financed: centsToFieldText(contract?.financed_cents),
    down_payment: centsToFieldText(contract?.down_payment_cents),
    term_months: contract ? String(contract.term_months) : '',
    nominal_rate: ppmToPercentText(contract?.nominal_rate_ppm),
    effective_rate: ppmToPercentText(contract?.effective_rate_ppm),
    effective_relationship_rate: ppmToPercentText(contract?.effective_relationship_rate_ppm),
    installment: centsToFieldText(contract?.installment_cents),
    reference_date: contract?.reference_date ?? '',
    reference_installment: contract ? String(contract.reference_installment) : '',
    settle_past: true,
    balance: centsToFieldText(contract?.balance_cents),
    balance_date: contract?.balance_date ?? '',
    auto_debit: contract?.auto_debit ?? false,
    auto_debit_account_id: contract?.auto_debit_account_id ?? '',
    notes: contract?.notes ?? '',
  }
}

function termsFromForm(v: FormValues): FinancingTerms {
  const balance = optionalCents(v.balance)
  return {
    contract_number: v.contract_number.trim() || null,
    purchase_date: v.purchase_date || null,
    financed_cents: optionalCents(v.financed),
    down_payment_cents: optionalCents(v.down_payment),
    nominal_rate_ppm: percentTextToPPM(v.nominal_rate),
    effective_rate_ppm: percentTextToPPM(v.effective_rate),
    effective_relationship_rate_ppm: percentTextToPPM(v.effective_relationship_rate),
    balance_cents: balance,
    // Saldo sem data vale como "informado hoje".
    balance_date: balance == null ? null : v.balance_date || todayISO(),
    auto_debit: v.auto_debit,
    auto_debit_account_id: v.auto_debit ? v.auto_debit_account_id || null : null,
    notes: v.notes.trim() || null,
  }
}

function SectionLabel({ children }: { children: string }) {
  return (
    <Typography variant="caption" color="text.secondary" fontWeight={600}>
      {children}
    </Typography>
  )
}

/**
 * Contrato de financiamento de um bem. No cadastro, a posição atual (parcela
 * X de Y vencendo em tal data) define a série inteira de parcelas, que a API
 * gera de uma vez. Na edição só os dados do contrato mudam: prazo, prestação
 * e posição já viraram parcelas.
 */
export function FinancingContractDialog({
  assetType,
  assetId,
  assetName,
  purchaseDate,
  contract,
  onClose,
}: {
  assetType: AssetType
  assetId: string
  /** Nome do bem, para a descrição padrão das parcelas. */
  assetName: string
  /** Data de compra do bem, quando conhecida: pré-preenche o formulário. */
  purchaseDate?: string | null
  /** Presente = edição dos dados do contrato. */
  contract?: FinancingContract
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(contract)

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, dirtyFields },
  } = useForm<FormValues>({ defaultValues: formDefaults(contract, assetName, purchaseDate) })

  const [
    purchase,
    referenceDate,
    referenceInstallment,
    termMonths,
    installment,
    settlePast,
    autoDebit,
    balance,
  ] = useWatch({
    control,
    name: [
      'purchase_date',
      'reference_date',
      'reference_installment',
      'term_months',
      'installment',
      'settle_past',
      'auto_debit',
      'balance',
    ],
  })

  // Número da parcela sugerido pela data da compra, enquanto o usuário não
  // digitar o dele — o do banco sempre prevalece.
  useEffect(() => {
    if (isEdit || dirtyFields.reference_installment) return
    const suggested = suggestInstallmentNumber(purchase, referenceDate)
    setValue('reference_installment', suggested ? String(suggested) : '')
  }, [isEdit, purchase, referenceDate, dirtyFields.reference_installment, setValue])

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: financeKeys.accounts(),
    queryFn: listAccounts,
    enabled: autoDebit,
  })

  const schedule = financingSchedule(referenceDate, Number(referenceInstallment), Number(termMonths))
  const installmentCents = reaisToCents(installment)

  const mutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const terms = termsFromForm(v)
      if (contract) {
        await updateFinancing(contract.id, terms)
        return 'Contrato atualizado.'
      }
      const res = await createFinancing({
        ...terms,
        asset_type: assetType,
        asset_id: assetId,
        supplier_id: v.supplier_id || null,
        description: v.description.trim(),
        term_months: Number(v.term_months),
        installment_cents: reaisToCents(v.installment),
        reference_date: v.reference_date,
        reference_installment: Number(v.reference_installment),
        settle_past: v.settle_past,
      })
      return `Financiamento registrado: ${res.created} parcelas geradas, ${res.settled} já pagas.`
    },
    onSuccess: (message) => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show(message)
      onClose()
    },
  })

  const submit = handleSubmit((v) => mutation.mutate(v))

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Editar contrato' : 'Novo financiamento'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          {!isEdit && (
            <>
              <Controller
                name="description"
                control={control}
                rules={{ required: 'Informe a descrição' }}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Descrição"
                    fullWidth
                    required
                    error={Boolean(errors.description)}
                    helperText={errors.description?.message ?? 'É o nome das parcelas na tela de despesas.'}
                  />
                )}
              />
              <Controller
                name="supplier_id"
                control={control}
                render={({ field }) => (
                  <SupplierField
                    label="Banco do financiamento"
                    value={field.value}
                    onChange={field.onChange}
                    createCategory="financeiro"
                    createLabel="Novo banco"
                  />
                )}
              />
            </>
          )}

          <Divider />
          <SectionLabel>CONTRATO (OPCIONAL)</SectionLabel>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="contract_number"
                control={control}
                render={({ field }) => <TextField {...field} label="Nº do contrato" fullWidth />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="purchase_date"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Data da compra"
                    type="date"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="financed"
                control={control}
                render={({ field }) => <MoneyField {...field} label="Valor financiado" fullWidth />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="down_payment"
                control={control}
                render={({ field }) => <MoneyField {...field} label="Valor de entrada" fullWidth />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller
                name="nominal_rate"
                control={control}
                render={({ field }) => (
                  <DecimalField
                    {...field}
                    decimals={RATE_DECIMALS}
                    unit="% a.a."
                    label="Juros nominais vigentes"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller
                name="effective_rate"
                control={control}
                render={({ field }) => (
                  <DecimalField
                    {...field}
                    decimals={RATE_DECIMALS}
                    unit="% a.a."
                    label="Juros efetivos"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller
                name="effective_relationship_rate"
                control={control}
                render={({ field }) => (
                  <DecimalField
                    {...field}
                    decimals={RATE_DECIMALS}
                    unit="% a.a."
                    label="Efetivos com relacionamento"
                    fullWidth
                  />
                )}
              />
            </Grid>
          </Grid>

          <Divider />
          <SectionLabel>POSIÇÃO ATUAL</SectionLabel>
          {isEdit ? (
            <Alert severity="info" sx={{ py: 0.5 }}>
              Prazo, prestação e parcela de referência já viraram parcelas. Para mudar a prestação use{' '}
              <strong>Reajustar prestação</strong>; para corrigir o resto, exclua e relance o contrato.
            </Alert>
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="installment"
                    control={control}
                    rules={{ validate: (v) => reaisToCents(v) > 0 || 'Informe o valor da prestação' }}
                    render={({ field }) => (
                      <MoneyField
                        {...field}
                        label="Valor da prestação"
                        fullWidth
                        required
                        error={Boolean(errors.installment)}
                        helperText={errors.installment?.message ?? 'O que sai da conta, com seguro e taxas.'}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="term_months"
                    control={control}
                    rules={{
                      validate: (v) =>
                        (Number.isInteger(Number(v)) && Number(v) >= 2 && Number(v) <= 600) ||
                        'Informe o prazo em meses (2 a 600)',
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Prazo contratado (meses)"
                        type="number"
                        fullWidth
                        required
                        inputProps={{ min: 2, max: 600 }}
                        error={Boolean(errors.term_months)}
                        helperText={errors.term_months?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="reference_date"
                    control={control}
                    rules={{ required: 'Informe o vencimento da parcela atual' }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Vencimento da parcela atual"
                        type="date"
                        fullWidth
                        required
                        InputLabelProps={{ shrink: true }}
                        error={Boolean(errors.reference_date)}
                        helperText={errors.reference_date?.message}
                      />
                    )}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Controller
                    name="reference_installment"
                    control={control}
                    rules={{
                      validate: (v, all) =>
                        (Number.isInteger(Number(v)) &&
                          Number(v) >= 1 &&
                          Number(v) <= Number(all.term_months)) ||
                        'Informe o número da parcela atual (de 1 até o prazo)',
                    }}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label="Nº da parcela atual"
                        type="number"
                        fullWidth
                        required
                        inputProps={{ min: 1 }}
                        error={Boolean(errors.reference_installment)}
                        helperText={
                          errors.reference_installment?.message ??
                          'Sugerido pela data da compra; confira com o app do banco ("Prestação").'
                        }
                      />
                    )}
                  />
                </Grid>
              </Grid>

              <Controller
                name="settle_past"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
                    }
                    label="Liquidar as parcelas anteriores pelo valor base, na data do vencimento"
                  />
                )}
              />

              {schedule && (
                <Alert
                  severity={settlePast || schedule.pastCount === 0 ? 'info' : 'warning'}
                  sx={{ py: 0.5 }}
                >
                  Serão geradas <strong>{termMonths} parcelas</strong>
                  {installmentCents > 0 && <> de {formatCents(installmentCents)}</>}, de{' '}
                  {formatDateBR(schedule.firstDueDate)} a {formatDateBR(schedule.lastDueDate)}:{' '}
                  <strong>{schedule.pastCount}</strong> anteriores
                  {settlePast ? ' (já pagas)' : ' (em aberto, vencidas)'} e{' '}
                  <strong>{schedule.remainingCount}</strong> a partir da atual. Prazo restante:{' '}
                  {schedule.remainingCount} meses.
                </Alert>
              )}
            </>
          )}

          <Divider />
          <SectionLabel>ACOMPANHAMENTO (OPCIONAL)</SectionLabel>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="balance"
                control={control}
                render={({ field }) => (
                  <MoneyField
                    {...field}
                    label="Saldo devedor"
                    fullWidth
                    helperText="O que o banco informa hoje — não é a soma das parcelas."
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="balance_date"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Saldo informado em"
                    type="date"
                    fullWidth
                    disabled={!balance.trim()}
                    InputLabelProps={{ shrink: true }}
                    helperText="Em branco = hoje."
                  />
                )}
              />
            </Grid>
          </Grid>

          <Controller
            name="auto_debit"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Débito automático: liquidar cada parcela sozinha no dia do vencimento"
              />
            )}
          />
          {autoDebit && (
            <Controller
              name="auto_debit_account_id"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Conta debitada"
                  emptyLabel="Não informar"
                  value={field.value}
                  onChange={field.onChange}
                  loading={accountsLoading}
                  options={(accounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
                />
              )}
            />
          )}

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Observações" fullWidth multiline minRows={2} />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : isEdit ? 'Salvar' : 'Registrar financiamento'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
