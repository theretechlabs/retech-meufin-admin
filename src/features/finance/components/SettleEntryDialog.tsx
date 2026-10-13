import { useEffect, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  formatCents,
  listAccounts,
  listCards,
  listDiscountReasons,
  reaisToCents,
  settleEntry,
  type Entry,
  type PaymentMethod,
} from '../api'
import {
  ACCOUNT_PAYMENT_METHODS,
  errorMessage,
  financeKeys,
  PAYMENT_METHOD_OPTIONS,
} from '../constants'
import { MoneyField } from '@/components/fields/MoneyField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { ErrorState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { ReceiptFilesPicker } from './ReceiptFilesPicker'
import { uploadReceiptsOrThrow } from '../receiptUpload'
import { LateChargesFields } from './LateChargesFields'
import {
  centsToMoneyText,
  EMPTY_LATE_CHARGES,
  lateChargesCents,
  type LateChargesValue,
} from '../lateCharges'

type FormValues = {
  paid_at: string // YYYY-MM-DD
  paid_amount: string // em reais (texto)
  discount: string // em reais (texto); vazio = sem desconto
  discount_reason: string // slug do catálogo; obrigatório com desconto
  residual_due_date: string // YYYY-MM-DD; só no pagamento parcial
  payment_method: PaymentMethod | '' // '' = não informar
  account_id: string
  card_id: string
  notes: string
}

/** Hoje no fuso local (toISOString() viraria o dia antes das 21h no Brasil). */
function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

type Totals = {
  discountCents: number
  /** Desconto igual ao valor: isenção total (bônus, cortesia, ressarcimento). */
  waived: boolean
  feeCents: number
  interestCents: number
  chargesCents: number
  /** Devido = valor − desconto + encargos. */
  expectedCents: number
  paidCents: number
  /** Devido − pago; > 0 vira lançamento residual. */
  residualCents: number
}

function computeTotals(
  entry: Entry,
  values: Pick<FormValues, 'discount' | 'paid_amount'>,
  charges: LateChargesValue,
): Totals {
  const discountCents = reaisToCents(values.discount)
  const waived = discountCents > 0 && discountCents >= entry.amount_cents
  // Isenção total não admite encargo (o backend rejeita): nem contamos.
  const feeCents = waived ? 0 : reaisToCents(charges.fee)
  const interestCents = waived ? 0 : reaisToCents(charges.interest)
  const chargesCents = waived ? 0 : lateChargesCents(charges)
  const expectedCents = Math.max(entry.amount_cents - discountCents + chargesCents, 0)
  const paidCents = waived ? 0 : reaisToCents(values.paid_amount)
  return {
    discountCents,
    waived,
    feeCents,
    interestCents,
    chargesCents,
    expectedCents,
    paidCents,
    residualCents: expectedCents - paidCents,
  }
}

/**
 * Liquidação de um lançamento (pagar despesa / receber receita): data, valor,
 * desconto com motivo, juros e multa por atraso, pagamento parcial com
 * residual, forma de pagamento (conta/cartão), observações e comprovantes.
 *
 * É o único diálogo de liquidação do admin — Despesas, Receitas e Contas do
 * dia usam este mesmo componente, e ele fala só com POST /entries/:id/settle.
 * Fatura pai cascateia para os filhos.
 */
export function SettleEntryDialog({
  entry,
  onClose,
  onSettled,
}: {
  entry: Entry
  onClose: () => void
  onSettled?: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [charges, setCharges] = useState<LateChargesValue>(EMPTY_LATE_CHARGES)
  const isExpense = entry.kind === 'debit'
  // Entry.type é IncomeType no modelo, mas em débitos carrega o slug da
  // categoria de despesa ('cartao' identifica fatura).
  const isInvoice = (entry.type as string | null | undefined) === 'cartao'
  const isParentInvoice = isInvoice && !entry.parent_id

  const { data: accounts } = useQuery({ queryKey: financeKeys.accounts(), queryFn: listAccounts })
  const { data: cards } = useQuery({ queryKey: financeKeys.cards(), queryFn: listCards })
  const { data: discountReasons } = useQuery({
    queryKey: financeKeys.discountReasons(),
    queryFn: listDiscountReasons,
  })

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      paid_at: todayISO(),
      paid_amount: centsToMoneyText(entry.amount_cents),
      discount: '',
      discount_reason: '',
      residual_due_date: entry.due_date,
      payment_method: '',
      account_id: '',
      card_id: entry.card_id ?? '',
      notes: '',
    },
  })

  const paidAt = useWatch({ control, name: 'paid_at' })
  const paidAmountText = useWatch({ control, name: 'paid_amount' })
  const discountText = useWatch({ control, name: 'discount' })
  const discountReason = useWatch({ control, name: 'discount_reason' })
  const method = useWatch({ control, name: 'payment_method' })
  const cardId = useWatch({ control, name: 'card_id' })
  const needsAccount = (ACCOUNT_PAYMENT_METHODS as readonly string[]).includes(method)
  const needsCard = method === 'cartao_credito'

  const totals = computeTotals(entry, { discount: discountText, paid_amount: paidAmountText }, charges)
  const { discountCents, waived, chargesCents, expectedCents, paidCents, residualCents } = totals

  // Devido muda (desconto, encargos) → valor pago acompanha. O usuário ainda
  // pode reduzir depois para registrar um pagamento parcial.
  useEffect(() => {
    setValue('paid_amount', centsToMoneyText(expectedCents))
  }, [expectedCents, setValue])

  const discountTooBig = discountCents > entry.amount_cents
  const discountInvalid = discountCents > 0 && (discountTooBig || !discountReason)
  const paidAboveDue = paidCents > expectedCents
  const paidMissing = !waived && paidCents <= 0
  const partialBlocked = residualCents > 0 && isInvoice
  const cardMissing = !waived && needsCard && !cardId
  const invalid = discountInvalid || paidAboveDue || paidMissing || partialBlocked || cardMissing

  // Liquidação já gravada na API: um retry (após falha de upload) só reenvia
  // os comprovantes pendentes, nunca liquida de novo.
  const [settled, setSettled] = useState(false)
  const [doneTotals, setDoneTotals] = useState<Totals | null>(null)

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!settled) {
        const t = computeTotals(entry, values, charges)
        // Isenção total: nada foi pago, forma de pagamento não se aplica.
        const method = !t.waived && values.payment_method !== '' ? values.payment_method : null
        const withMethod = method !== null
        await settleEntry(entry.id, {
          paid_at: values.paid_at,
          paid_amount_cents: t.paidCents,
          discount_cents: t.discountCents > 0 ? t.discountCents : null,
          discount_reason: t.discountCents > 0 ? values.discount_reason : null,
          late_fee_cents: t.feeCents > 0 ? t.feeCents : null,
          late_interest_cents: t.interestCents > 0 ? t.interestCents : null,
          residual_due_date:
            t.residualCents > 0 && values.residual_due_date !== entry.due_date
              ? values.residual_due_date
              : null,
          payment_method: method,
          account_id: withMethod && needsAccount && values.account_id ? values.account_id : null,
          card_id: withMethod && needsCard && values.card_id ? values.card_id : null,
          notes: values.notes.trim() || null,
        })
        setDoneTotals(t)
        setSettled(true)
      }
      await uploadReceiptsOrThrow(entry.id, files, setFiles)
    },
    onSettled: () => {
      // Mesmo com falha no upload, a liquidação pode ter sido gravada.
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
    onSuccess: () => {
      show(successMessage(doneTotals ?? totals))
      onSettled?.()
      onClose()
    },
  })

  function successMessage(t: Totals): string {
    const noun = isExpense ? 'Pagamento' : 'Recebimento'
    if (t.expectedCents === 0) {
      return `Registrado: nada a ${isExpense ? 'pagar' : 'receber'} neste período. A recorrência segue normalmente.`
    }
    if (t.residualCents > 0) {
      return `${noun} parcial confirmado. Residual de ${formatCents(t.residualCents)} criado.`
    }
    if (t.discountCents > 0) {
      return `${noun} confirmado com ${formatCents(t.discountCents)} de desconto.`
    }
    if (t.chargesCents > 0) {
      return `${noun} confirmado com ${formatCents(t.chargesCents)} de juros e multa.`
    }
    return isExpense ? 'Despesa confirmada como paga.' : 'Receita confirmada como recebida.'
  }

  const submit = handleSubmit((values) => {
    if (!settled && invalid) return
    mutation.mutate(values)
  })

  const paidHelper = paidAboveDue
    ? `Não pode ser maior que o devido (${formatCents(expectedCents)}): juros e multa entram nos campos acima`
    : paidMissing
      ? 'Informe o valor'
      : discountCents > 0 || chargesCents > 0
        ? `Devido ${formatCents(expectedCents)} = ${formatCents(entry.amount_cents)}${
            discountCents > 0 ? ` − ${formatCents(discountCents)} de desconto` : ''
          }${chargesCents > 0 ? ` + ${formatCents(chargesCents)} de encargos` : ''}`
        : `Menor que o devido = ${isExpense ? 'pagamento' : 'recebimento'} parcial`

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isExpense ? 'Pagar lançamento' : 'Receber lançamento'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">
              {entry.description || 'Sem descrição'}
            </Typography>
            <Typography variant="subtitle1" fontWeight={800}>
              {formatCents(entry.amount_cents)}
            </Typography>
          </Stack>

          {isParentInvoice && (
            <Alert severity="info">
              Esta é uma fatura de cartão: ao liquidar, todas as compras dentro dela também são
              marcadas como realizadas.
            </Alert>
          )}

          <Controller
            name="paid_at"
            control={control}
            rules={{ required: 'Informe a data' }}
            render={({ field }) => (
              <TextField
                {...field}
                type="date"
                label={isExpense ? 'Pago em' : 'Recebido em'}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                error={Boolean(errors.paid_at)}
                helperText={errors.paid_at?.message}
              />
            )}
          />

          {!waived && (
            <LateChargesFields
              entryId={entry.id}
              paidAt={paidAt}
              value={charges}
              onChange={setCharges}
              disabled={mutation.isPending || settled}
            />
          )}

          <Controller
            name="discount"
            control={control}
            render={({ field }) => (
              <MoneyField
                {...field}
                label="Desconto (opcional)"
                fullWidth
                error={discountTooBig}
                helperText={
                  discountTooBig
                    ? 'Desconto não pode ser maior que o valor do lançamento'
                    : waived
                      ? `Isenção total: nada a ${isExpense ? 'pagar' : 'receber'} neste período.`
                      : undefined
                }
              />
            )}
          />
          {discountCents > 0 && (
            <Controller
              name="discount_reason"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Motivo do desconto"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={!discountReason}
                  helperText={!discountReason ? 'Informe o motivo' : undefined}
                  options={(discountReasons ?? []).map((r) => ({
                    value: r.slug,
                    label: r.name,
                    description: r.description,
                  }))}
                  placeholder="Ex.: pagamento antecipado"
                />
              )}
            />
          )}

          {!waived && (
            <Controller
              name="paid_amount"
              control={control}
              render={({ field }) => (
                <MoneyField
                  {...field}
                  label={isExpense ? 'Valor pago' : 'Valor recebido'}
                  fullWidth
                  required
                  error={paidAboveDue || paidMissing}
                  helperText={paidHelper}
                />
              )}
            />
          )}

          {residualCents > 0 && !paidMissing && !isInvoice && (
            <>
              <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                {isExpense ? 'Pagamento' : 'Recebimento'} parcial: um lançamento residual de{' '}
                <strong>{formatCents(residualCents)}</strong> será criado.
              </Alert>
              <Controller
                name="residual_due_date"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    type="date"
                    label="Vencimento do residual"
                    fullWidth
                    InputLabelProps={{ shrink: true }}
                    helperText="Data original = residual nasce vencido; data futura = renegociado"
                  />
                )}
              />
            </>
          )}
          {partialBlocked && !paidMissing && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              Pagamento parcial de fatura de cartão ainda não é suportado.
            </Alert>
          )}

          {!waived && (
            <Controller
              name="payment_method"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label={isExpense ? 'Forma de pagamento' : 'Forma de recebimento'}
                  emptyLabel="Não informar"
                  value={field.value}
                  onChange={(v) => field.onChange(v as PaymentMethod | '')}
                  options={PAYMENT_METHOD_OPTIONS}
                  helperText={
                    field.value
                      ? undefined
                      : 'Opcional, mas registra de onde saiu (ou onde entrou) o dinheiro.'
                  }
                />
              )}
            />
          )}

          {!waived && needsAccount && (
            <Controller
              name="account_id"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Conta"
                  emptyLabel="Não informar"
                  value={field.value}
                  onChange={field.onChange}
                  options={(accounts ?? []).map((a) => ({
                      value: a.id,
                      label: a.name,
                      description: a.bank_name ?? undefined,
                    }))}
                />
              )}
            />
          )}

          {!waived && needsCard && (
            <Controller
              name="card_id"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Cartão de crédito"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  error={cardMissing}
                  helperText={
                    cardMissing
                      ? 'Informe o cartão usado'
                      : 'A compra entra na próxima fatura do cartão — registre-a lá também.'
                  }
                  options={(cards ?? []).map((c) => ({ value: c.id, label: c.name }))}
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

          <Divider />

          <ReceiptFilesPicker files={files} onChange={setFiles} disabled={mutation.isPending} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={submit}
          variant="contained"
          color="success"
          disabled={mutation.isPending || (!settled && invalid)}
        >
          {mutation.isPending
            ? settled
              ? 'Enviando comprovantes…'
              : 'Liquidando…'
            : settled
              ? 'Reenviar comprovantes'
              : isExpense
                ? 'Confirmar pagamento'
                : 'Confirmar recebimento'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
