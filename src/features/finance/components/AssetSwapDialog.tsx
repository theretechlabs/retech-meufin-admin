import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAssetSwap,
  formatCents,
  getAssetDebts,
  getInstallmentsProjection,
  getRenegotiationPreview,
  listAccounts,
  listSuppliers,
  reaisToCents,
  type Payer,
  type PaymentMethod,
} from '../api'
import {
  ACCOUNT_PAYMENT_METHODS,
  errorMessage,
  financeKeys,
  PAYMENT_METHOD_OPTIONS,
} from '../constants'
import { useExpenseCategories } from '../hooks/useExpenseCategories'
import { addMonthsClamped, todayISO } from '../installments'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { MoneyField } from '@/components/fields/MoneyField'
import { ErrorState } from '@/features/health/components/StateViews'
import { listVehiclesPaged, type Vehicle } from '@/features/vehicles/api'
import { vehicleKeys } from '@/features/vehicles/constants'
import { useToast } from '@/providers/ToastProvider'

const STEPS = ['Veículo antigo', 'Troca', 'Veículo novo', 'Confirmar']

function formatDateBR(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function vehicleLabel(v: Vehicle): string {
  const name = v.nickname ?? `${v.make} ${v.model}`
  return v.plate ? `${name} · ${v.plate}` : name
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 600}>
        {value}
      </Typography>
    </Stack>
  )
}

/**
 * Troca de veículo financiado — o caso mais comum de "dívida que vira outra":
 * o usado entra como parte do pagamento, a concessionária quita o contrato
 * antigo (quase sempre por menos que o saldo) e um financiamento novo nasce
 * no carro novo. Um único evento amarra tudo: quitação, venda do usado,
 * entrada em dinheiro e a série nova, com o histórico das duas dívidas
 * navegável nos dois sentidos.
 */
export function AssetSwapDialog({
  onClose,
  initialOldVehicleId,
  initialOldGroupId,
  onDone,
}: {
  onClose: () => void
  initialOldVehicleId?: string
  initialOldGroupId?: string
  onDone?: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const { activeCategories } = useExpenseCategories()

  const [step, setStep] = useState(0)
  const [date, setDate] = useState(todayISO())

  // Passo 1 — veículo antigo e contrato.
  const [oldVehicleId, setOldVehicleId] = useState(initialOldVehicleId ?? '')
  const [oldGroupId, setOldGroupId] = useState(initialOldGroupId ?? '')
  const [payoffText, setPayoffText] = useState('')
  const [payer, setPayer] = useState<Payer>('terceiro')
  const [payoffMethod, setPayoffMethod] = useState<PaymentMethod>('pix')
  const [payoffAccountId, setPayoffAccountId] = useState('')

  // Passo 2 — troca.
  const [tradeInText, setTradeInText] = useState('')
  const [cashText, setCashText] = useState('')
  const [cashMethod, setCashMethod] = useState<PaymentMethod>('pix')
  const [cashAccountId, setCashAccountId] = useState('')
  const [newPriceText, setNewPriceText] = useState('')

  // Passo 3 — veículo novo e financiamento.
  const [newVehicleId, setNewVehicleId] = useState('')
  const [financed, setFinanced] = useState(true)
  const [countText, setCountText] = useState('')
  const [installmentText, setInstallmentText] = useState('')
  const [firstDue, setFirstDue] = useState(addMonthsClamped(todayISO(), 1))
  const [contractDesc, setContractDesc] = useState('')
  const [category, setCategory] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [notes, setNotes] = useState('')

  const vehiclesQ = useQuery({
    queryKey: vehicleKeys.list({ limit: 200, offset: 0, scope: 'swap' }),
    queryFn: () => listVehiclesPaged({ limit: 200, offset: 0 }),
  })
  const vehicles = useMemo(() => vehiclesQ.data?.items ?? [], [vehiclesQ.data])
  const oldVehicle = vehicles.find((v) => v.id === oldVehicleId)
  const newVehicle = vehicles.find((v) => v.id === newVehicleId)

  // Contratos vinculados ao veículo antigo (com linhagem) + fallback: todos os
  // parcelamentos, para quem ainda não vinculou o financiamento ao carro.
  const assetDebtsQ = useQuery({
    queryKey: financeKeys.assetDebts('vehicle', oldVehicleId),
    queryFn: () => getAssetDebts('vehicle', oldVehicleId),
    enabled: Boolean(oldVehicleId),
  })
  const projectionQ = useQuery({
    queryKey: [...financeKeys.all, 'installments-projection'] as const,
    queryFn: getInstallmentsProjection,
  })
  const contractOptions = useMemo(() => {
    const linked = (assetDebtsQ.data?.debts ?? [])
      .filter((d) => !d.settled)
      .map((d) => ({
        value: d.current_group_id,
        label: d.description,
        description: `Vinculado ao veículo · ${formatCents(d.open_cents)} em aberto`,
      }))
    const linkedIds = new Set(linked.map((o) => o.value))
    const others = (projectionQ.data?.groups ?? [])
      .filter((g) => g.source === 'expense' && g.group_id && !linkedIds.has(g.group_id))
      .map((g) => ({
        value: g.group_id as string,
        label: g.description,
        description: `${g.remaining_count}x restantes · ${formatCents(g.remaining_cents)}`,
      }))
    return [...linked, ...others]
  }, [assetDebtsQ.data, projectionQ.data])

  const previewQ = useQuery({
    queryKey: financeKeys.renegotiationPreview(oldGroupId),
    queryFn: () => getRenegotiationPreview(oldGroupId),
    enabled: Boolean(oldGroupId),
  })
  const preview = previewQ.data
  const openTotal = oldGroupId ? (preview?.open_total_cents ?? 0) : 0

  const { data: accounts } = useQuery({ queryKey: financeKeys.accounts(), queryFn: listAccounts })
  const { data: suppliers } = useQuery({ queryKey: financeKeys.suppliers(), queryFn: listSuppliers })
  const supplierOptions = (suppliers ?? [])
    .filter((sp) => sp.active)
    .map((sp) => ({ value: sp.id, label: sp.name }))
  const newSupplier = (suppliers ?? []).find((sp) => sp.id === supplierId)
  const accountOptions = (accounts ?? []).map((a) => ({
    value: a.id,
    label: a.name,
    description: a.bank_name ?? undefined,
  }))

  const payoffCents = oldGroupId ? reaisToCents(payoffText) : 0
  const tradeInCents = reaisToCents(tradeInText)
  const cashCents = reaisToCents(cashText)
  const newPriceCents = reaisToCents(newPriceText)
  const count = Math.trunc(Number(countText)) || 0
  const installmentCents = reaisToCents(installmentText)
  const newTotal = financed ? count * installmentCents : 0
  const netDown = tradeInCents - payoffCents + cashCents
  const payoffDelta = payoffCents - openTotal
  const payoffNeedsAccount =
    payer === 'proprio' && (ACCOUNT_PAYMENT_METHODS as readonly string[]).includes(payoffMethod)
  const cashNeedsAccount = (ACCOUNT_PAYMENT_METHODS as readonly string[]).includes(cashMethod)

  const step0Ok = Boolean(oldVehicleId) && (!oldGroupId || (payoffCents > 0 && Boolean(preview)))
  const step1Ok = tradeInCents >= 0 && (tradeInCents > 0 || cashCents > 0 || Boolean(oldGroupId))
  const step2Ok =
    Boolean(newVehicleId) &&
    newVehicleId !== oldVehicleId &&
    (!financed || (count > 0 && installmentCents > 0 && Boolean(firstDue)))

  const mutation = useMutation({
    mutationFn: () =>
      createAssetSwap({
        date,
        asset_type: 'vehicle',
        old_asset_id: oldVehicleId,
        new_asset_id: newVehicleId,
        old_asset_label: oldVehicle ? vehicleLabel(oldVehicle) : undefined,
        new_asset_label: newVehicle ? vehicleLabel(newVehicle) : undefined,
        old_group_id: oldGroupId || null,
        payoff_cents: payoffCents || undefined,
        payer: oldGroupId ? payer : undefined,
        payoff_payment_method: oldGroupId && payer === 'proprio' ? payoffMethod : undefined,
        payoff_payment_account_id:
          oldGroupId && payer === 'proprio' && payoffNeedsAccount && payoffAccountId ? payoffAccountId : null,
        trade_in_cents: tradeInCents,
        cash_downpayment_cents: cashCents || undefined,
        cash_payment_method: cashCents > 0 ? cashMethod : undefined,
        cash_payment_account_id: cashCents > 0 && cashNeedsAccount && cashAccountId ? cashAccountId : null,
        new_asset_price_cents: newPriceCents > 0 ? newPriceCents : null,
        new_contract: financed
          ? {
              installment_count: count,
              installment_cents: installmentCents,
              first_due_date: firstDue,
              description: contractDesc.trim() || undefined,
              category: category || null,
              supplier_id: supplierId || null,
            }
          : null,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      qc.invalidateQueries({ queryKey: vehicleKeys.all })
      show(
        `Troca registrada: ${res.event.origin_count} cobranças encerradas, ` +
          `${res.event.new_count} parcelas criadas.`
      )
      onDone?.()
      onClose()
    },
  })

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Troca de veículo</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mt: 1, mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {/* ---------------- Passo 1: veículo antigo + contrato ---------------- */}
        {step === 0 && (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box sx={{ flex: 2, minWidth: 240 }}>
                <AutocompleteField
                  label="Veículo que saiu (dado na troca)"
                  value={oldVehicleId}
                  onChange={(v) => {
                    setOldVehicleId(v)
                    setOldGroupId('')
                  }}
                  options={vehicles.map((v) => ({
                    value: v.id,
                    label: vehicleLabel(v),
                    description: `${v.year_manufacture}/${v.year_model}${v.status === 'sold' ? ' · vendido' : ''}`,
                  }))}
                  required
                />
              </Box>
              <TextField
                type="date"
                label="Data da troca"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 170 }}
              />
            </Box>

            <AutocompleteField
              label="Financiamento do veículo antigo"
              emptyLabel="Sem financiamento (já estava quitado)"
              value={oldGroupId}
              onChange={setOldGroupId}
              options={contractOptions}
              disabled={!oldVehicleId}
            />

            {oldGroupId && previewQ.isError && <ErrorState message={errorMessage(previewQ.error)} />}
            {oldGroupId && preview && (
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={3} flexWrap="wrap" useFlexGap>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Já pago
                      </Typography>
                      <Typography variant="h6">{formatCents(preview.paid_cents)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {preview.paid_count} de {preview.installment_total} parcelas
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Saldo em aberto
                      </Typography>
                      <Typography variant="h6" color="warning.main">
                        {formatCents(preview.open_total_cents)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {preview.installment_count + preview.residual_count} cobranças
                      </Typography>
                    </Box>
                  </Stack>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <MoneyField
                      label="Valor de quitação pago ao banco"
                      value={payoffText}
                      onChange={(e) => setPayoffText(e.target.value)}
                      sx={{ minWidth: 220, flex: 1 }}
                      helperText="Quanto a concessionária (ou você) pagou para encerrar o contrato"
                    />
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                        Quem pagou a quitação?
                      </Typography>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={payer}
                        onChange={(_, v: Payer | null) => v && setPayer(v)}
                      >
                        <ToggleButton value="terceiro">Concessionária</ToggleButton>
                        <ToggleButton value="proprio">Eu, do meu caixa</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </Box>
                  {payer === 'proprio' && (
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <TextField
                        select
                        label="Forma de pagamento"
                        value={payoffMethod}
                        onChange={(e) => setPayoffMethod(e.target.value as PaymentMethod)}
                        sx={{ minWidth: 200, flex: 1 }}
                      >
                        {PAYMENT_METHOD_OPTIONS.map((o) => (
                          <MenuItem key={o.value} value={o.value}>
                            {o.label}
                          </MenuItem>
                        ))}
                      </TextField>
                      {payoffNeedsAccount && (
                        <Box sx={{ minWidth: 200, flex: 1 }}>
                          <AutocompleteField
                            label="Conta"
                            emptyLabel="Não informar"
                            value={payoffAccountId}
                            onChange={setPayoffAccountId}
                            options={accountOptions}
                          />
                        </Box>
                      )}
                    </Box>
                  )}
                  {payoffCents > 0 && (
                    <Alert severity={payoffDelta < 0 ? 'success' : payoffDelta > 0 ? 'warning' : 'info'} sx={{ py: 0.5 }}>
                      {payoffDelta < 0 && (
                        <>
                          Economia de <strong>{formatCents(-payoffDelta)}</strong> sobre o saldo (juros
                          futuros abatidos na quitação).
                        </>
                      )}
                      {payoffDelta > 0 && (
                        <>
                          <strong>{formatCents(payoffDelta)}</strong> acima do saldo (multa/encargos).
                        </>
                      )}
                      {payoffDelta === 0 && 'Quitação pelo valor exato do saldo.'}
                    </Alert>
                  )}
                </Stack>
              </Paper>
            )}
            {oldVehicleId && !oldGroupId && (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Sem contrato selecionado: o veículo antigo entra como quitado e o valor da troca vira
                entrada integral.
              </Alert>
            )}
          </Stack>
        )}

        {/* ---------------- Passo 2: valores da troca ---------------- */}
        {step === 1 && (
          <Stack spacing={2}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <MoneyField
                label="Quanto o veículo antigo valeu na troca"
                value={tradeInText}
                onChange={(e) => setTradeInText(e.target.value)}
                sx={{ minWidth: 240, flex: 1 }}
                autoFocus
                helperText="Valor de avaliação do usado aceito pela concessionária"
              />
              <MoneyField
                label="Preço do veículo novo (opcional)"
                value={newPriceText}
                onChange={(e) => setNewPriceText(e.target.value)}
                sx={{ minWidth: 220, flex: 1 }}
                helperText="Preenche a aquisição no cadastro do veículo"
              />
            </Box>

            <Divider>
              <Typography variant="caption" color="text.secondary">
                Entrada em dinheiro (opcional)
              </Typography>
            </Divider>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <MoneyField
                label="Valor pago em dinheiro"
                value={cashText}
                onChange={(e) => setCashText(e.target.value)}
                sx={{ minWidth: 200, flex: 1 }}
              />
              {cashCents > 0 && (
                <>
                  <TextField
                    select
                    label="Forma de pagamento"
                    value={cashMethod}
                    onChange={(e) => setCashMethod(e.target.value as PaymentMethod)}
                    sx={{ minWidth: 180, flex: 1 }}
                  >
                    {PAYMENT_METHOD_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>
                        {o.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  {cashNeedsAccount && (
                    <Box sx={{ minWidth: 200, flex: 1 }}>
                      <AutocompleteField
                        label="Conta"
                        emptyLabel="Não informar"
                        value={cashAccountId}
                        onChange={setCashAccountId}
                        options={accountOptions}
                      />
                    </Box>
                  )}
                </>
              )}
            </Box>

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={0.75}>
                <Row label="Veículo antigo valeu" value={formatCents(tradeInCents)} />
                {oldGroupId && <Row label="− Quitação do contrato antigo" value={formatCents(payoffCents)} />}
                {cashCents > 0 && <Row label="+ Entrada em dinheiro" value={formatCents(cashCents)} />}
                <Divider />
                <Row label="Entrada líquida no veículo novo" value={formatCents(netDown)} strong />
              </Stack>
              {netDown < 0 && (
                <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
                  O usado valia menos que a quitação: a diferença de {formatCents(-netDown)} foi
                  coberta em dinheiro ou rolada no financiamento novo. Confira os valores.
                </Alert>
              )}
            </Paper>
          </Stack>
        )}

        {/* ---------------- Passo 3: veículo novo + financiamento ---------------- */}
        {step === 2 && (
          <Stack spacing={2}>
            <AutocompleteField
              label="Veículo novo"
              value={newVehicleId}
              onChange={setNewVehicleId}
              options={vehicles
                .filter((v) => v.id !== oldVehicleId && v.status !== 'sold')
                .map((v) => ({
                  value: v.id,
                  label: vehicleLabel(v),
                  description: `${v.year_manufacture}/${v.year_model}`,
                }))}
              required
            />
            {vehicles.filter((v) => v.id !== oldVehicleId && v.status !== 'sold').length === 0 && (
              <Alert severity="warning" sx={{ py: 0.5 }}>
                Cadastre o veículo novo na Frota antes de registrar a troca.
              </Alert>
            )}

            <FormControlLabel
              control={<Switch checked={financed} onChange={(e) => setFinanced(e.target.checked)} />}
              label="Veículo novo financiado"
            />

            {financed && (
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    type="number"
                    label="Quantidade de parcelas"
                    value={countText}
                    onChange={(e) => setCountText(e.target.value)}
                    inputProps={{ min: 1 }}
                    sx={{ minWidth: 160 }}
                  />
                  <MoneyField
                    label="Valor da parcela"
                    value={installmentText}
                    onChange={(e) => setInstallmentText(e.target.value)}
                    sx={{ minWidth: 180 }}
                  />
                  <TextField
                    type="date"
                    label="1º vencimento"
                    value={firstDue}
                    onChange={(e) => setFirstDue(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{ minWidth: 170 }}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <TextField
                    label="Descrição do financiamento"
                    value={contractDesc}
                    onChange={(e) => setContractDesc(e.target.value)}
                    placeholder={newVehicle ? `Financiamento — ${vehicleLabel(newVehicle)}` : 'Financiamento'}
                    sx={{ minWidth: 240, flex: 2 }}
                  />
                  <Box sx={{ minWidth: 200, flex: 1 }}>
                    <AutocompleteField
                      label="Categoria"
                      emptyLabel={preview?.category ? 'Mesma do contrato antigo' : 'Financiamentos'}
                      value={category}
                      onChange={setCategory}
                      options={activeCategories.map((c) => ({ value: c.slug, label: c.name }))}
                    />
                  </Box>
                </Box>
                {/* Trocou de carro, quase sempre trocou de banco: o credor do
                    financiamento novo é escolhido aqui, não herdado. */}
                <AutocompleteField
                  label="Banco / credor do financiamento novo"
                  emptyLabel={oldGroupId ? 'Mesmo do contrato antigo' : 'Não informar'}
                  value={supplierId}
                  onChange={setSupplierId}
                  options={supplierOptions}
                />
                {newTotal > 0 && (
                  <Alert severity="info" sx={{ py: 0.5 }}>
                    Financiamento novo: <strong>{formatCents(newTotal)}</strong> em {count}× de{' '}
                    {formatCents(installmentCents)}, de {formatDateBR(firstDue)} a{' '}
                    {formatDateBR(addMonthsClamped(firstDue, count - 1))}.
                  </Alert>
                )}
              </Stack>
            )}

            <TextField
              label="Observações (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        )}

        {/* ---------------- Passo 4: resumo ---------------- */}
        {step === 3 && (
          <Stack spacing={2}>
            {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Confira antes de aplicar
            </Typography>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Stack spacing={0.75}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={oldVehicle ? vehicleLabel(oldVehicle) : '—'} />
                  <Typography variant="body2" color="text.secondary">
                    →
                  </Typography>
                  <Chip size="small" color="primary" label={newVehicle ? vehicleLabel(newVehicle) : '—'} />
                  <Typography variant="caption" color="text.secondary">
                    em {formatDateBR(date)}
                  </Typography>
                </Stack>
                <Divider sx={{ my: 0.5 }} />
                {oldGroupId && preview && (
                  <>
                    <Row label="Saldo devedor do contrato antigo" value={formatCents(openTotal)} />
                    <Row
                      label={`Quitado por ${payer === 'terceiro' ? 'concessionária' : 'você'}`}
                      value={formatCents(payoffCents)}
                    />
                    {payoffDelta !== 0 && (
                      <Row
                        label={payoffDelta < 0 ? 'Economia na quitação' : 'Encargos na quitação'}
                        value={formatCents(Math.abs(payoffDelta))}
                      />
                    )}
                    <Divider sx={{ my: 0.5 }} />
                  </>
                )}
                <Row label="Veículo antigo valeu" value={formatCents(tradeInCents)} />
                {cashCents > 0 && <Row label="Entrada em dinheiro" value={formatCents(cashCents)} />}
                <Row label="Entrada líquida" value={formatCents(netDown)} strong />
                <Divider sx={{ my: 0.5 }} />
                {financed ? (
                  <Row
                    label={`Financiamento novo${newSupplier ? ` · ${newSupplier.name}` : ''}`}
                    value={`${count}× ${formatCents(installmentCents)} = ${formatCents(newTotal)}`}
                    strong
                  />
                ) : (
                  <Row label="Financiamento novo" value="À vista (sem parcelas)" />
                )}
                {oldGroupId && preview && (
                  <Row label="Endividamento" value={`${formatCents(openTotal)} → ${formatCents(newTotal)}`} />
                )}
              </Stack>
            </Paper>
            <Alert severity="info" sx={{ py: 0.5 }}>
              O que será registrado: {oldGroupId ? 'quitação do contrato antigo, ' : ''}venda do
              veículo antigo (marcado como vendido){cashCents > 0 ? ', entrada em dinheiro' : ''}
              {financed ? ' e as parcelas do financiamento novo' : ''}. Quitação e venda são
              compensadas — só a entrada em dinheiro mexe no seu caixa.
            </Alert>
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        {step > 0 && (
          <Button onClick={() => setStep(step - 1)} disabled={mutation.isPending}>
            Voltar
          </Button>
        )}
        {step === 0 && (
          <Button variant="contained" onClick={() => setStep(1)} disabled={!step0Ok}>
            Continuar
          </Button>
        )}
        {step === 1 && (
          <Button variant="contained" onClick={() => setStep(2)} disabled={!step1Ok}>
            Continuar
          </Button>
        )}
        {step === 2 && (
          <Button variant="contained" onClick={() => setStep(3)} disabled={!step2Ok}>
            Revisar
          </Button>
        )}
        {step === 3 && (
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Registrar troca
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
