import { Fragment, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CancelRoundedIcon from '@mui/icons-material/CancelRounded'
import MoneyOffRoundedIcon from '@mui/icons-material/MoneyOffRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded'
import CallSplitRoundedIcon from '@mui/icons-material/CallSplitRounded'
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded'
import ReceiptRoundedIcon from '@mui/icons-material/ReceiptRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  confirmEntry,
  listDiscountReasons,
  listFiscalItems,
  reopenEntry,
  createEntry,
  uploadEntryAttachment,
  formatCents,
  getEntriesSummary,
  listEntries,
  listFamilyMembers,
  listSuppliers,
  reaisToCents,
  resizeInstallments,
  updateEntry,
  type ConfirmEntryPayload,
  type Entry,
  type EntryInput,
  type ListEntriesParams,
} from '../api'
import {
  ENTRY_STATUS_COLOR,
  ENTRY_STATUS_LABEL,
  ENTRY_STATUS_OPTIONS,
  errorMessage,
  financeKeys,
  MONTH_OPTIONS,
  RECURRENCE_LABEL,
  RECURRENCE_OPTIONS,
  seriesToast } from '../constants'
import { MoneyField } from '@/components/fields/MoneyField'
import {
  createExpenseCategory,
  type ExpenseCategory,
  type ExpenseGroup,
} from '../api'
import { useExpenseCategories } from '../hooks/useExpenseCategories'
import { useYearOptions } from '../hooks/useYearOptions'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { formatDateBR } from '@/utils/dates'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { DeleteEntryDialog } from '../components/DeleteEntryDialog'
import { InstallmentsEditor } from '../components/InstallmentsEditor'
import {
  addMonthsClamped,
  buildInstallmentRows,
  rowsToPayload,
  validateInstallmentRows,
  type InstallmentRow,
} from '../installments'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { PurchaseEditDialog } from '../components/PurchaseEditDialog'
import { WaiveEntryDialog } from '../components/WaiveEntryDialog'
import { LateChargesFields } from '../components/LateChargesFields'
import {
  bpToPercentText,
  EMPTY_LATE_CHARGES,
  lateChargesCents,
  percentTextToBp,
  type LateChargesValue,
} from '../lateCharges'
import { DecimalField } from '@/components/fields/DecimalField'
import { EntryDetailDialog } from '../components/EntryDetailDialog'
import { AttachmentDraftList, type AttachmentDraft } from '../components/EntryAttachments'
import { isAttachmentReplicable } from '../constants'
import { CancelEntryDialog } from '../components/CancelEntryDialog'
import { ReceiptFilesPicker } from '../components/ReceiptFilesPicker'
import { uploadReceiptsOrThrow } from '../receiptUpload'

const now = new Date()

type Filters = {
  family_member_id: string
  year: number
  month: number
  status: string
  type: string
}

const initialFilters: Filters = {
  family_member_id: '',
  year: now.getFullYear(),
  month: now.getMonth() + 1,
  status: '',
  type: '',
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: string
  /** Uma linha explicando o recorte (eixo, contagem). Evita a leitura errada do número. */
  hint?: string
  color?: string
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800, color, mt: 0.5 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Form types
// ---------------------------------------------------------------------------

type EntryFormValues = {
  family_member_id: string
  supplier_id: string
  type: string
  amount: string // reais
  due_date: string
  recurrence: EntryInput['recurrence']
  installments: boolean
  installments_count: string
  /** Número da parcela que vence em due_date (1 = a série começa nela). */
  installment_current: string
  confirm_past: boolean
  description: string
  notes: string
  /** Termos de atraso em % (texto pt-BR). Vazio = padrão do sistema. */
  late_fee_pct: string
  late_interest_pct: string
  apply_to_future: boolean
}

function emptyEntryForm(): EntryFormValues {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    family_member_id: '',
    supplier_id: '',
    type: 'moradia',
    amount: '',
    due_date: `${y}-${m}-${d}`,
    recurrence: 'none',
    installments: false,
    installments_count: '2',
    installment_current: '1',
    confirm_past: false,
    description: '',
    notes: '',
    late_fee_pct: '',
    late_interest_pct: '',
    apply_to_future: false,
  }
}

// ---------------------------------------------------------------------------
// Entry form dialog
// ---------------------------------------------------------------------------


function QuickCategoryForm({
  groups,
  onCreated,
  onCancel,
}: {
  groups: ExpenseGroup[]
  onCreated: (category: ExpenseCategory) => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const { control, handleSubmit } = useForm<{ name: string; group_slug: string }>({
    defaultValues: { name: '', group_slug: 'outros' },
  })

  const mutation = useMutation({
    mutationFn: (values: { name: string; group_slug: string }) =>
      createExpenseCategory({ name: values.name.trim(), group_slug: values.group_slug }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: financeKeys.expenseCategories() })
      onCreated(created)
    },
  })

  const submit = handleSubmit((values) => {
    if (!values.name.trim()) return
    mutation.mutate(values)
  })

  return (
    <Box
      sx={{ p: 2, borderRadius: 1, border: 1, borderColor: 'divider', bgcolor: 'action.hover' }}
    >
      <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
        Criar categoria rápida
      </Typography>
      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {errorMessage(mutation.error)}
        </Alert>
      )}
      <Stack spacing={1.5}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <TextField {...field} label="Nome" size="small" fullWidth placeholder="Ex.: Pets" />
          )}
        />
        <Controller
          name="group_slug"
          control={control}
          render={({ field }) => (
            <AutocompleteField
              label="Grupo (indicadores)"
              size="small"
              value={field.value}
              onChange={field.onChange}
              options={groups.map((g) => ({
                value: g.slug,
                label: g.name,
                description: g.description,
              }))}
              placeholder="Busque por nome ou exemplo (ex.: cinema)"
            />
          )}
        />
        <Stack direction="row" spacing={1} justifyContent="flex-end">
          <Button size="small" color="inherit" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button size="small" variant="contained" onClick={submit} disabled={mutation.isPending}>
            Criar
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Linha de detalhe: compras da fatura OU itens do cupom fiscal
// ---------------------------------------------------------------------------

/** Quantidade em milésimos → "1", "0,455". */
function formatQtyMilli(milli: number): string {
  return (milli / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function ExpenseDetailRow({
  entry,
  colSpan,
  open,
  categoryLabel,
}: {
  entry: Entry
  colSpan: number
  open: boolean
  categoryLabel: (v?: string | null) => string
}) {
  const isInvoice = (entry.type as string | null | undefined) === 'cartao'
  const [toEditPurchase, setToEditPurchase] = useState<Entry | null>(null)

  const childrenQuery = useQuery({
    queryKey: financeKeys.entries({ parent_id: entry.id }),
    queryFn: () => listEntries({ parent_id: entry.id, kind: 'debit', limit: 500 }),
    enabled: open && isInvoice,
  })
  const fiscalQuery = useQuery({
    queryKey: [...financeKeys.all, 'fiscal-items', entry.id] as const,
    queryFn: () => listFiscalItems(entry.id),
    enabled: open && !isInvoice && Boolean(entry.fiscal_document_id),
  })

  const children = childrenQuery.data?.items ?? []
  const childrenSum = children.reduce((acc, c) => acc + c.amount_cents, 0)
  const fiscalItems = fiscalQuery.data ?? []

  return (
    <TableRow>
      <TableCell colSpan={colSpan} sx={{ py: 0, borderBottom: open ? undefined : 'none' }}>
        <Collapse in={open} timeout="auto" unmountOnExit>
          <Box sx={{ py: 1.5, pl: 4 }}>
            {isInvoice ? (
              childrenQuery.isLoading ? (
                <LoadingState />
              ) : children.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma compra nesta fatura.
                </Typography>
              ) : (
                <>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Data da compra</TableCell>
                      <TableCell>Descrição</TableCell>
                      <TableCell>Categoria</TableCell>
                      <TableCell align="right">Valor</TableCell>
                      <TableCell align="right">Ações</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {children.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          {c.purchase_date ? formatDateBR(c.purchase_date) : '—'}
                        </TableCell>
                        <TableCell>{c.description}</TableCell>
                        <TableCell>{categoryLabel(c.type)}</TableCell>
                        <TableCell align="right">{formatCents(c.amount_cents)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Editar compra">
                            <IconButton size="small" onClick={() => setToEditPurchase(c)}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {children.length > 0 && (
                  <Typography
                    variant="caption"
                    color={childrenSum !== entry.amount_cents ? 'warning.main' : 'text.secondary'}
                    sx={{ display: 'block', textAlign: 'right', mt: 1 }}
                  >
                    Soma das compras: {formatCents(childrenSum)}
                    {childrenSum !== entry.amount_cents
                      ? ` — difere do total da fatura (${formatCents(entry.amount_cents)})`
                      : ''}
                  </Typography>
                )}
                </>
              )
            ) : fiscalQuery.isLoading ? (
              <LoadingState />
            ) : fiscalItems.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhum item de cupom vinculado.
              </Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Item</TableCell>
                    <TableCell align="right">Qtd.</TableCell>
                    <TableCell align="right">Unit.</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell>Categoria</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {fiscalItems.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.description}</TableCell>
                      <TableCell align="right">{formatQtyMilli(it.quantity_milli)}</TableCell>
                      <TableCell align="right">
                        {it.unit_cents ? formatCents(it.unit_cents) : '—'}
                      </TableCell>
                      <TableCell align="right">{formatCents(it.amount_cents)}</TableCell>
                      <TableCell>{it.category ? categoryLabel(it.category) : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Box>
        </Collapse>
        {toEditPurchase && (
          <PurchaseEditDialog purchase={toEditPurchase} onClose={() => setToEditPurchase(null)} />
        )}
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Dialog: confirmar pagamento (com desconto opcional)
// ---------------------------------------------------------------------------

function ConfirmPaymentDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [discountText, setDiscountText] = useState('')
  const [reason, setReason] = useState('')
  const [paidText, setPaidText] = useState('')
  const [residualDate, setResidualDate] = useState(entry.due_date)
  const [paidDate, setPaidDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [files, setFiles] = useState<File[]>([])
  const [charges, setCharges] = useState<LateChargesValue>(EMPTY_LATE_CHARGES)
  // Confirmação já gravada na API: um retry (após falha de upload) só reenvia
  // os comprovantes pendentes, nunca confirma de novo.
  const [confirmed, setConfirmed] = useState(false)

  const reasonsQuery = useQuery({
    queryKey: financeKeys.discountReasons(),
    queryFn: listDiscountReasons,
  })

  const discountCents = reaisToCents(discountText)
  const feeCents = reaisToCents(charges.fee)
  const interestCents = reaisToCents(charges.interest)
  // Isenção total não admite encargo: o backend rejeita, então nem oferece.
  const waived = discountCents > 0 && discountCents >= entry.amount_cents
  const chargesCents = waived ? 0 : lateChargesCents(charges)
  const expectedCents = entry.amount_cents - discountCents + chargesCents
  const paidCents = reaisToCents(paidText)
  const paidProvided = paidCents > 0
  const residualCents = paidProvided ? expectedCents - paidCents : 0

  // Desconto igual ao valor é isenção total (bônus/cortesia/ressarcimento) e
  // é válido; só acima do valor é erro. Nesse caso o pago vai a zero.
  const discountInvalid =
    discountCents > 0 && (discountCents > entry.amount_cents || !reason)
  const paidInvalid = paidProvided && paidCents > expectedCents
  // Entry.type é IncomeType no modelo, mas em débitos carrega o slug da
  // categoria de despesa ('cartao' identifica fatura).
  const isInvoice = (entry.type as string | null | undefined) === 'cartao'
  const partialBlocked = residualCents > 0 && isInvoice

  const mutation = useMutation({
    mutationFn: async () => {
      if (!confirmed) {
        await confirmWithPayload()
        setConfirmed(true)
      }
      await uploadReceiptsOrThrow(entry.id, files, setFiles)
    },
    onSettled: () => {
      // Mesmo com falha no upload, a confirmação pode ter sido gravada.
      qc.invalidateQueries({ queryKey: financeKeys.all })
    },
    onSuccess: () => {
      if (expectedCents === 0) {
        show('Registrado: nada a pagar neste mês. A recorrência segue normalmente.')
      } else if (residualCents > 0) {
        show(`Pagamento parcial confirmado. Residual de ${formatCents(residualCents)} criado.`)
      } else if (discountCents > 0) {
        show(`Pagamento confirmado com ${formatCents(discountCents)} de desconto.`)
      } else if (chargesCents > 0) {
        show(`Pagamento confirmado com ${formatCents(chargesCents)} de juros e multa.`)
      } else {
        show('Despesa confirmada como paga.')
      }
      onClose()
    },
  })

  function confirmWithPayload() {
    const payload: ConfirmEntryPayload = {}
    if (paidDate) {
      payload.paid_at = paidDate
    }
    if (discountCents > 0) {
      payload.discount_cents = discountCents
      payload.discount_reason = reason
    }
    if (chargesCents > 0) {
      if (feeCents > 0) payload.late_fee_cents = feeCents
      if (interestCents > 0) payload.late_interest_cents = interestCents
    }
    if (expectedCents === 0) {
      // Isenção total: pago zero explícito, sem residual.
      payload.paid_amount_cents = 0
    } else if (paidProvided && paidCents < expectedCents) {
      payload.paid_amount_cents = paidCents
      if (residualDate && residualDate !== entry.due_date) {
        payload.residual_due_date = residualDate
      }
    }
    return confirmEntry(entry.id, payload)
  }

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Confirmar pagamento</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Typography variant="body2" color="text.secondary">
            {entry.description} — {formatCents(entry.amount_cents)}
          </Typography>
          <TextField
            type="date"
            label="Data do pagamento"
            value={paidDate}
            onChange={(e) => setPaidDate(e.target.value)}
            fullWidth
            InputLabelProps={{ shrink: true }}
            helperText="Quando o pagamento foi feito (padrão: hoje)"
          />
          {!waived && (
            <LateChargesFields
              entryId={entry.id}
              paidAt={paidDate}
              value={charges}
              onChange={setCharges}
              disabled={mutation.isPending || confirmed}
            />
          )}
          <MoneyField
            label="Desconto (opcional)"
            value={discountText}
            onChange={(e) => setDiscountText(e.target.value)}
            fullWidth
            error={discountCents > 0 && discountCents > entry.amount_cents}
            helperText={
              discountCents > 0 && discountCents > entry.amount_cents
                ? 'Desconto não pode ser maior que o valor da despesa'
                : discountCents > 0 && discountCents === entry.amount_cents
                  ? 'Isenção total: nada a pagar neste mês.'
                  : undefined
            }
          />
          {discountCents > 0 && (
            <AutocompleteField
              label="Motivo do desconto"
              value={reason}
              onChange={setReason}
              options={(reasonsQuery.data ?? []).map((r) => ({
                value: r.slug,
                label: r.name,
                description: r.description,
              }))}
              placeholder="Ex.: pagamento antecipado"
            />
          )}
          <MoneyField
            label="Valor pago (opcional)"
            value={paidText}
            onChange={(e) => setPaidText(e.target.value)}
            fullWidth
            error={paidInvalid}
            helperText={
              paidInvalid
                ? `Valor pago não pode ser maior que o devido (${formatCents(expectedCents)})`
                : chargesCents > 0
                  ? `Vazio = pagamento integral de ${formatCents(expectedCents)} (inclui ${formatCents(chargesCents)} de encargos)`
                  : `Vazio = pagamento integral de ${formatCents(expectedCents)}`
            }
          />
          {residualCents > 0 && !isInvoice && (
            <>
              <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                Pagamento parcial: um lançamento residual de{' '}
                <strong>{formatCents(residualCents)}</strong> será criado.
              </Alert>
              <TextField
                type="date"
                label="Vencimento do residual"
                value={residualDate}
                onChange={(e) => setResidualDate(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                helperText="Data original = residual nasce vencido; data futura = renegociado"
              />
            </>
          )}
          {partialBlocked && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              Pagamento parcial de fatura de cartão ainda não é suportado.
            </Alert>
          )}
          <Divider />
          <ReceiptFilesPicker files={files} onChange={setFiles} disabled={mutation.isPending} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button color="inherit" onClick={onClose} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          color="success"
          onClick={() => mutation.mutate()}
          disabled={
            mutation.isPending || (!confirmed && (discountInvalid || paidInvalid || partialBlocked))
          }
        >
          {mutation.isPending
            ? confirmed
              ? 'Enviando comprovantes…'
              : 'Confirmando…'
            : confirmed
              ? 'Reenviar comprovantes'
              : 'Confirmar pagamento'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function EntryFormDialog({
  open,
  entry,
  onClose,
  onCreatedRecurring,
}: {
  open: boolean
  entry: Entry | null
  onClose: () => void
  onCreatedRecurring: (count: number) => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(entry)

  const membersQuery = useQuery({
    queryKey: financeKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })
  const suppliersQuery = useQuery({
    queryKey: financeKeys.suppliers(),
    queryFn: listSuppliers,
  })
  const { activeCategories, groups } = useExpenseCategories()
  const [quickCategory, setQuickCategory] = useState(false)
  // Anexos (boleto, QR Pix…) do form: sobem depois do create/update. Em série,
  // QR Pix e contrato replicam às parcelas futuras (create: sempre; edit: se
  // "Aplicar às próximas" estiver ligado); boleto/nota/fatura ficam só no
  // lançamento alvo (1ª parcela no create) — cada parcela tem o seu.
  const [attachmentDrafts, setAttachmentDrafts] = useState<AttachmentDraft[]>([])

  /** Sobe os rascunhos no lançamento alvo; devolve quantos falharam (não desfaz a despesa). */
  const uploadDrafts = async (targetId: string, replicate: boolean): Promise<number> => {
    let failed = 0
    for (const d of attachmentDrafts) {
      try {
        await uploadEntryAttachment(targetId, {
          ...d,
          apply_to: replicate && isAttachmentReplicable(d.attachment_type) ? 'future' : undefined,
        })
      } catch {
        failed++
      }
    }
    return failed
  }

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<EntryFormValues>({
    values: entry
      ? {
          family_member_id: entry.family_member_id ?? '',
          supplier_id: entry.supplier_id ?? '',
          type: entry.type ?? 'moradia',
          amount: (entry.amount_cents / 100).toFixed(2).replace('.', ','),
          due_date: entry.due_date,
          recurrence: entry.recurrence,
          installments: false,
          installments_count: '2',
          installment_current: '1',
          confirm_past: false,
          description: entry.description,
          notes: entry.notes ?? '',
          late_fee_pct: bpToPercentText(entry.late_fee_bp),
          late_interest_pct: bpToPercentText(entry.late_interest_monthly_bp),
          apply_to_future: false,
        }
      : emptyEntryForm(),
  })

  const recurrence = useWatch({ control, name: 'recurrence' })
  const installments = useWatch({ control, name: 'installments' })
  const amountText = useWatch({ control, name: 'amount' })
  const installmentsCount = useWatch({ control, name: 'installments_count' })
  const installmentCurrent = useWatch({ control, name: 'installment_current' })
  const dueDateText = useWatch({ control, name: 'due_date' })
  // Editor parcela a parcela: aberto, a lista é o que vale no submit.
  const [editorOpen, setEditorOpen] = useState(false)
  const [installmentRows, setInstallmentRows] = useState<InstallmentRow[]>([])

  // Vencimento da 1ª parcela: a data informada é a da parcela nº
  // installment_current, então a série começa (current - 1) meses antes.
  const firstDueDate = useMemo(() => {
    if (!installments || !dueDateText) return dueDateText
    const cur = Math.trunc(Number(installmentCurrent))
    if (!Number.isFinite(cur) || cur <= 1) return dueDateText
    return addMonthsClamped(dueDateText, -(cur - 1))
  }, [installments, dueDateText, installmentCurrent])

  const regenerateRows = () => {
    const n = Math.trunc(Number(installmentsCount))
    const count = Number.isFinite(n) && n >= 2 ? n : 2
    setInstallmentRows(buildInstallmentRows(firstDueDate, count, reaisToCents(amountText ?? '')))
  }
  const openEditor = () => {
    regenerateRows()
    setEditorOpen(true)
  }
  const applyToFuture = useWatch({ control, name: 'apply_to_future' })
  const [resizeTotal, setResizeTotal] = useState('')
  const [resizeArmed, setResizeArmed] = useState(false)
  const editDueDate = useWatch({ control, name: 'due_date' })
  const dueDateDirty = Boolean(isEdit && entry && editDueDate && editDueDate !== entry.due_date)
  const isInstallmentEntry = Boolean(entry?.installment_number && entry?.installment_total)

  // "Parcela 7 de 48 · 41 restantes de R$ 1.898,77 · termina em jun/2030"
  const installmentSummary = useMemo(() => {
    if (!entry?.installment_number || !entry?.installment_total) return ''
    const num = entry.installment_number
    const total = entry.installment_total
    const remaining = total - num
    const due = new Date(`${entry.due_date}T00:00:00`)
    const end = new Date(due.getFullYear(), due.getMonth() + remaining, 1)
    const endLabel = end.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
    const per = entry.amount_cents
    if (remaining <= 0) {
      return `Parcela ${num} de ${total} — última parcela deste parcelamento.`
    }
    return (
      `Parcela ${num} de ${total} — restam ${remaining} de ${formatCents(per)} ` +
      `(${formatCents(per * remaining)}), terminando em ${endLabel}.`
    )
  }, [entry])

  // "15× de R$ 1.500,00 = R$ 22.500,00 no total" — mata a ambiguidade
  // parcela × total na origem.
  const installmentsSummary = useMemo(() => {
    const n = Math.trunc(Number(installmentsCount))
    const per = reaisToCents(amountText ?? '')
    if (!installments || !Number.isFinite(n) || n < 2 || per <= 0) return ''
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-')
      return `${d}/${m}/${y}`
    }
    const range = firstDueDate ? ` De ${fmt(firstDueDate)} a ${fmt(addMonthsClamped(firstDueDate, n - 1))}.` : ''
    return `${n}× de ${formatCents(per)} = ${formatCents(per * n)} no total.${range}`
  }, [installments, installmentsCount, amountText, firstDueDate])

  const isPastDate = useMemo(() => {
    const ref = installments ? firstDueDate : dueDateText
    if (!ref) return false
    return ref < new Date().toISOString().slice(0, 10)
  }, [installments, firstDueDate, dueDateText])

  const mutation = useMutation({
    mutationFn: async (values: EntryFormValues) => {
      const base: EntryInput = {
        kind: 'debit',
        status: entry?.status ?? 'prevista',
        amount_cents: reaisToCents(values.amount),
        due_date: values.due_date,
        family_member_id: values.family_member_id || null,
        source_id: null,
        type: (values.type || null) as EntryInput['type'],
        description: values.description.trim(),
        recurrence: values.installments ? 'none' : values.recurrence,
        notes: values.notes.trim() || null,
        supplier_id: values.supplier_id || null,
      }
      // Termos de atraso: no create só vão se preenchidos; no update vão
      // sempre (null nos dois = volta ao padrão), porque a chave presente é
      // o que diz ao backend "grave isto".
      const feeBp = percentTextToBp(values.late_fee_pct)
      const interestBp = percentTextToBp(values.late_interest_pct)
      if (isEdit || feeBp != null || interestBp != null) {
        base.late_fee_bp = feeBp
        base.late_interest_monthly_bp = interestBp
      }
      if (!isEdit && values.installments) {
        if (editorOpen) {
          // Lista ajustada à mão: cada parcela leva vencimento, valor e
          // liquidação próprios; o backend numera por vencimento.
          const problem = validateInstallmentRows(installmentRows)
          if (problem) throw new Error(problem)
          const sorted = installmentRows.slice().sort((a, b) => a.due_date.localeCompare(b.due_date))
          base.installments = rowsToPayload(sorted)
          base.installments_total = sorted.length
          base.due_date = sorted[0].due_date
          base.amount_cents = reaisToCents(sorted[0].amount)
        } else {
          const n = Number(values.installments_count)
          base.installments_total = Number.isFinite(n) && n >= 2 ? Math.trunc(n) : 2
          // "Esta é a parcela nº X": a série começa X-1 meses antes.
          base.due_date = firstDueDate
        }
      }
      if (!isEdit && values.confirm_past && !editorOpen) {
        base.confirm_past_occurrences = true
      }
      if (isEdit) {
        if (values.apply_to_future) base.apply_to = 'future'
        const updated = await updateEntry(entry!.id, base)
        const attachmentsFailed = await uploadDrafts(
          entry!.id,
          Boolean(entry!.recurrence_group_id) && values.apply_to_future,
        )
        return {
          created: 0,
          appliedToFuture: values.apply_to_future,
          dueDatesUpdated: updated.series_due_dates_updated ?? 0,
          fieldsUpdated: updated.series_fields_updated ?? 0,
          newDueDay: Number(values.due_date.slice(8, 10)) || null,
          attachmentsFailed,
        }
      }
      const res = await createEntry(base)
      const created = res.total ?? res.items?.length ?? 1
      // Alvo dos anexos: a 1ª parcela (menor vencimento). Em série, os
      // replicáveis (QR Pix, contrato) se propagam às demais via apply_to.
      const first = [...(res.items ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
      const attachmentsFailed = first ? await uploadDrafts(first.id, created > 1) : 0
      return {
        created,
        appliedToFuture: false,
        dueDatesUpdated: 0,
        fieldsUpdated: 0,
        newDueDay: null,
        attachmentsFailed,
      }
    },
    onSuccess: (r) => {
      const { created, appliedToFuture, dueDatesUpdated, fieldsUpdated, newDueDay } = r
      if (r.attachmentsFailed > 0) {
        show(
          `${isEdit ? 'Despesa salva' : 'Despesa criada'}, mas ${r.attachmentsFailed} anexo(s) não foram enviados. Anexe pelo detalhe do lançamento.`,
        )
      } else if (isEdit) {
        show(
          seriesToast('Despesa', appliedToFuture, dueDatesUpdated, fieldsUpdated, newDueDay, isInstallmentEntry),
        )
      } else if (created <= 1) {
        show('Despesa criada com sucesso.')
      }
      qc.invalidateQueries({ queryKey: financeKeys.all })
      reset(emptyEntryForm())
      setEditorOpen(false)
      setInstallmentRows([])
      setAttachmentDrafts([])
      onClose()
      if (!isEdit && created > 1) onCreatedRecurring(created)
    },
  })

  const resizeMutation = useMutation({
    mutationFn: async () => {
      const n = Math.trunc(Number(resizeTotal))
      if (!Number.isFinite(n) || n < 1) throw new Error('Informe um total válido de parcelas.')
      return resizeInstallments(entry!.id, n)
    },
    onSuccess: (r) => {
      const parts: string[] = []
      if (r.removed > 0) parts.push(`${r.removed} parcela(s) excluída(s)`)
      if (r.created > 0) parts.push(`${r.created} parcela(s) criada(s)`)
      parts.push(`${r.updated} atualizada(s)`)
      show(`Parcelamento ajustado para ${r.new_total}x — ${parts.join(', ')}.`)
      qc.invalidateQueries({ queryKey: financeKeys.all })
      setResizeTotal('')
      setResizeArmed(false)
      onClose()
    },
  })

  // Delta do redimensionamento para o aviso de confirmação.
  const resizeDelta = useMemo(() => {
    const n = Math.trunc(Number(resizeTotal))
    const current = entry?.installment_total ?? 0
    if (!Number.isFinite(n) || n < 1 || !current || n === current) return null
    return n < current
      ? { kind: 'shrink' as const, count: current - n, target: n }
      : { kind: 'grow' as const, count: n - current, target: n }
  }, [resizeTotal, entry])

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog
      open={open}
      onClose={mutation.isPending ? undefined : onClose}
      // Editor de parcelas aberto: a tabela precisa de largura pra respirar.
      maxWidth={editorOpen && installments ? 'md' : 'sm'}
      fullWidth
    >
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar despesa' : 'Nova despesa'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          {isEdit && installmentSummary && (
            <Alert severity="info" icon={<RepeatRoundedIcon />}>
              {installmentSummary}
            </Alert>
          )}

          {isEdit && entry?.recurrence_group_id && entry?.installment_total && (
            <Stack spacing={1}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                alignItems={{ xs: 'stretch', sm: 'flex-start' }}
              >
                <TextField
                  type="number"
                  label="Corrigir total de parcelas"
                  size="small"
                  value={resizeTotal}
                  onChange={(e) => {
                    setResizeTotal(e.target.value)
                    setResizeArmed(false)
                  }}
                  inputProps={{ min: 1 }}
                  sx={{ width: { xs: '100%', sm: 260 } }}
                  helperText={`Total atual: ${entry.installment_total}x`}
                />
                {!resizeArmed ? (
                  <Button
                    variant="outlined"
                    disabled={!resizeDelta || resizeMutation.isPending}
                    onClick={() => setResizeArmed(true)}
                    sx={{ height: 40, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    Redimensionar…
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color={resizeDelta?.kind === 'shrink' ? 'error' : 'primary'}
                    disabled={resizeMutation.isPending}
                    onClick={() => resizeMutation.mutate()}
                    sx={{ height: 40, flexShrink: 0, whiteSpace: 'nowrap' }}
                  >
                    Confirmar {resizeDelta?.target}x
                  </Button>
                )}
              </Stack>
              {resizeArmed && resizeDelta && (
                <Alert severity={resizeDelta.kind === 'shrink' ? 'warning' : 'info'}>
                  {resizeDelta.kind === 'shrink'
                    ? `As ${resizeDelta.count} última(s) parcela(s) prevista(s) serão excluídas e as demais passam a exibir "de ${resizeDelta.target}". Parcelas já realizadas acima do novo total bloqueiam a operação.`
                    : `${resizeDelta.count} nova(s) parcela(s) prevista(s) serão criadas seguindo o dia e o valor da última, e todas passam a exibir "de ${resizeDelta.target}".`}
                </Alert>
              )}
              {resizeMutation.isError && (
                <ErrorState message={errorMessage(resizeMutation.error)} />
              )}
            </Stack>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="family_member_id"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Membro da família"
                  emptyLabel="Não atribuído"
                  value={field.value}
                  onChange={field.onChange}
                  options={(membersQuery.data ?? []).map((m) => ({
                    value: m.id,
                    label: m.full_name,
                  }))}
                />
              )}
            />
            <Controller
              name="supplier_id"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Fornecedor"
                  emptyLabel="Nenhum"
                  value={field.value}
                  onChange={field.onChange}
                  options={(suppliersQuery.data ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                    description: s.category,
                  }))}
                  placeholder="Busque por nome…"
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Stack spacing={1} sx={{ width: '100%' }}>
              <Controller
                name="type"
                control={control}
                render={({ field }) => {
                  const selected = activeCategories.find((c) => c.slug === field.value)
                  return (
                    <AutocompleteField
                      label="Categoria"
                      value={field.value}
                      onChange={field.onChange}
                      options={activeCategories.map((cat) => ({
                        value: cat.slug,
                        label: cat.name,
                        description: cat.group_name,
                        keywords: groups.find((g) => g.slug === cat.group_slug)?.description,
                      }))}
                      placeholder="Busque por nome, grupo ou exemplo"
                      helperText={
                        selected ? `Grupo: ${selected.group_name} (indicadores)` : undefined
                      }
                    />
                  )
                }}
              />
              {quickCategory ? (
                <QuickCategoryForm
                  groups={groups}
                  onCreated={(created) => {
                    setValue('type', created.slug)
                    setQuickCategory(false)
                  }}
                  onCancel={() => setQuickCategory(false)}
                />
              ) : (
                <Button
                  size="small"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => setQuickCategory(true)}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Criar categoria rápida
                </Button>
              )}
            </Stack>
            <Controller
              name="amount"
              control={control}
              rules={{
                required: 'Informe o valor',
                validate: (v) => reaisToCents(v) > 0 || 'Valor deve ser maior que zero',
              }}
              render={({ field }) => (
                <MoneyField
                  {...field}
                  label={installments ? 'Valor da parcela' : 'Valor'}
                  fullWidth
                  required
                  error={Boolean(errors.amount)}
                  helperText={
                    errors.amount?.message ??
                    (installments ? 'Valor de CADA parcela, não o total' : undefined)
                  }
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="due_date"
              control={control}
              rules={{ required: 'Informe a data' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Data"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.due_date)}
                  helperText={errors.due_date?.message}
                />
              )}
            />
            <Controller
              name="recurrence"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  select
                  label="Recorrência"
                  fullWidth
                  disabled={isEdit || installments}
                >
                  {RECURRENCE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>

          {!isEdit && (
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
              <Controller
                name="installments"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    sx={{ flexShrink: 0 }}
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => {
                          field.onChange(e.target.checked)
                          // Desligar o parcelado descarta o editor aberto.
                          if (!e.target.checked) setEditorOpen(false)
                        }}
                      />
                    }
                    label="Parcelado"
                  />
                )}
              />
              {installments && (
                <Controller
                  name="installments_count"
                  control={control}
                  rules={{
                    validate: (v) =>
                      !installments ||
                      Number(v) >= 2 ||
                      'Informe ao menos 2 parcelas',
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="number"
                      label="Número de parcelas"
                      fullWidth
                      inputProps={{ min: 2 }}
                      error={Boolean(errors.installments_count)}
                      helperText={
                        errors.installments_count?.message ??
                        (editorOpen ? 'Editor aberto: vale a lista abaixo' : undefined)
                      }
                    />
                  )}
                />
              )}
              {installments && (
                <Controller
                  name="installment_current"
                  control={control}
                  rules={{
                    validate: (v) => {
                      if (!installments) return true
                      const cur = Math.trunc(Number(v))
                      const n = Math.trunc(Number(installmentsCount))
                      if (!Number.isFinite(cur) || cur < 1) return 'Mínimo 1'
                      if (Number.isFinite(n) && cur > n) return 'Maior que o total'
                      return true
                    },
                  }}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      type="number"
                      label="A data acima é a parcela nº"
                      fullWidth
                      inputProps={{ min: 1 }}
                      error={Boolean(errors.installment_current)}
                      helperText={
                        errors.installment_current?.message ??
                        (Number(installmentCurrent) > 1 ? 'As anteriores são geradas para trás' : undefined)
                      }
                    />
                  )}
                />
              )}
            </Stack>
          )}

          {!isEdit && installments && !editorOpen && (
            <Alert
              severity="info"
              icon={<RepeatRoundedIcon />}
              action={
                <Button size="small" color="inherit" startIcon={<TuneRoundedIcon />} onClick={openEditor}>
                  Ajustar parcelas
                </Button>
              }
            >
              Ao salvar, o sistema gera as <strong>parcelas mensais</strong> previstas (X/N).
              {installmentsSummary && (
                <>
                  {' '}
                  <strong>{installmentsSummary}</strong>
                </>
              )}
            </Alert>
          )}

          {!isEdit && installments && editorOpen && (
            <Stack spacing={1.5}>
              <Alert
                severity="info"
                icon={<TuneRoundedIcon />}
                action={
                  <Button size="small" color="inherit" onClick={() => setEditorOpen(false)}>
                    Voltar ao automático
                  </Button>
                }
              >
                Ajuste vencimento e valor de cada parcela. Marque <strong>Paga</strong> nas que já
                foram quitadas (data e valor pago) — elas nascem realizadas. A lista abaixo é o que
                será criado; número e valor do formulário deixam de valer.
              </Alert>
              <InstallmentsEditor
                rows={installmentRows}
                onChange={setInstallmentRows}
                onRegenerate={regenerateRows}
                disabled={mutation.isPending}
              />
            </Stack>
          )}

          {!isEdit && !installments && recurrence !== 'none' && (
            <Alert severity="info" icon={<RepeatRoundedIcon />}>
              Ao salvar, o sistema gera os lançamentos <strong>previstos</strong> dos próximos 12
              meses — e mantém sempre 1 ano à frente. Para encerrar a recorrência, cancele a
              ocorrência mais recente.
            </Alert>
          )}

          {!isEdit && (installments || recurrence !== 'none') && isPastDate && !editorOpen && (
            <Controller
              name="confirm_past"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(e) => field.onChange(e.target.checked)}
                    />
                  }
                  label="Parcelas/lançamentos já vencidos foram pagos (nascem como realizados)"
                />
              )}
            />
          )}

          {isEdit && entry?.recurrence_group_id && dueDateDirty && !applyToFuture && (
            <Alert severity="warning" icon={<RepeatRoundedIcon />}>
              A data de vencimento mudou, mas com a opção abaixo desligada a alteração
              vale <strong>só para este lançamento</strong>. Para mover também 
              {isInstallmentEntry ? 'as próximas parcelas' : 'as próximas ocorrências'}, ligue &quot;Aplicar às próximas&quot;.
            </Alert>
          )}

          {isEdit && entry?.recurrence_group_id && (
            <>
              <Controller
                name="apply_to_future"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label={
                      isInstallmentEntry
                        ? 'Aplicar às próximas parcelas'
                        : 'Aplicar às próximas ocorrências desta recorrência'
                    }
                  />
                )}
              />
              {applyToFuture && (
                <Alert severity="info" icon={<RepeatRoundedIcon />}>
                  <strong>Data de vencimento</strong>: o novo dia é aplicado às{' '}
                  {isInstallmentEntry ? 'parcelas' : 'ocorrências'} <strong>desta em diante</strong>{' '}
                  (inclusive realizadas), cada uma no seu mês — as anteriores preservam o
                  vencimento histórico. Valor, descrição, categoria e termos de atraso (multa e
                  juros): apenas nas previstas futuras. Canceladas ficam de fora.
                </Alert>
              )}
            </>
          )}

          <Controller
            name="description"
            control={control}
            rules={{ required: 'Informe uma descrição' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Descrição"
                fullWidth
                required
                error={Boolean(errors.description)}
                helperText={errors.description?.message}
              />
            )}
          />

          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Observações" fullWidth multiline minRows={2} />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="late_fee_pct"
              control={control}
              render={({ field }) => (
                <DecimalField
                  {...field}
                  decimals={2}
                  unit="%"
                  label="Multa por atraso"
                  placeholder="2,00"
                  fullWidth
                  helperText="Vazio = padrão 2%"
                />
              )}
            />
            <Controller
              name="late_interest_pct"
              control={control}
              render={({ field }) => (
                <DecimalField
                  {...field}
                  decimals={2}
                  unit="% a.m."
                  label="Juros ao mês"
                  placeholder="1,00"
                  fullWidth
                  helperText="Vazio = padrão 1% a.m., pro rata dia"
                />
              )}
            />
          </Stack>

          <Divider />
          <AttachmentDraftList
            drafts={attachmentDrafts}
            onChange={setAttachmentDrafts}
            disabled={mutation.isPending}
            inSeries={isEdit ? Boolean(entry?.recurrence_group_id) : installments || recurrence !== 'none'}
            applyToFuture={isEdit ? applyToFuture : true}
          />
          {attachmentDrafts.length > 0 && !isEdit && (installments || recurrence !== 'none') && (
            <Alert severity="info">
              Os anexos entram na 1ª parcela. QR Code Pix e contrato são replicados para as
              parcelas seguintes; boleto, nota e fatura ficam só na 1ª — cada parcela tem o seu.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          {isEdit ? 'Salvar' : 'Criar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DespesasPage() {
  const yearsList = useYearOptions()
  const qc = useQueryClient()
  const { show } = useToast()
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [toDelete, setToDelete] = useState<Entry | null>(null)
  const [toCancel, setToCancel] = useState<Entry | null>(null)
  const [toWaive, setToWaive] = useState<Entry | null>(null)
  const [toDetail, setToDetail] = useState<Entry | null>(null)
  const [toReopen, setToReopen] = useState<Entry | null>(null)
  const [toConfirm, setToConfirm] = useState<Entry | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const membersQuery = useQuery({
    queryKey: financeKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })
  const suppliersListQuery = useQuery({
    queryKey: financeKeys.suppliers(),
    queryFn: listSuppliers,
  })
  const discountReasonsQuery = useQuery({
    queryKey: financeKeys.discountReasons(),
    queryFn: listDiscountReasons,
  })
  const { activeCategories, labelOf } = useExpenseCategories()

  const listParams: ListEntriesParams = useMemo(() => {
    const p: ListEntriesParams = {
      kind: 'debit',
      year: filters.year,
      month: filters.month,
      limit: pageSize,
      offset: page * pageSize,
    }
    if (filters.family_member_id) p.family_member_id = filters.family_member_id
    if (filters.status) p.status = filters.status as ListEntriesParams['status']
    if (filters.type) p.type = filters.type as ListEntriesParams['type']
    if (query.trim()) p.query = query.trim()
    // Agrupado por default: compras de fatura ficam dentro da fatura (expandir).
    // Filtro por categoria vira visão plana — as compras casam individualmente.
    if (!filters.type && !query.trim()) p.top_level = true
    return p
  }, [filters, query, page, pageSize])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: financeKeys.entries(listParams as Record<string, unknown>),
    queryFn: () => listEntries(listParams),
  })

  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      setToReopen(null)
      show('Pagamento desfeito. Despesa voltou a prevista.')
    },
    // O ConfirmDialog não exibe erro — sem isto a falha era silenciosa
    // (ex.: residual renegociado bloqueia a reabertura, e nada aparecia).
    onError: (err) => {
      setToReopen(null)
      show(errorMessage(err), 'error')
    },
  })

  const entries = useMemo(() => data?.items ?? [], [data])

  const memberName = (id?: string | null) =>
    (membersQuery.data ?? []).find((m) => m.id === id)?.full_name ?? '—'
  const categoryName = (value?: string | null) => labelOf(value)
  const supplierName = (id?: string | null) =>
    (suppliersListQuery.data ?? []).find((s) => s.id === id)?.name ?? null
  const discountReasonName = (slug?: string | null) =>
    (discountReasonsQuery.data ?? []).find((r) => r.slug === slug)?.name ?? slug ?? '—'

  // Cards vêm da API, nos dois eixos, pelo mês/ano/membro — NÃO somam a
  // página visível (paginada em {pageSize}) e ignoram status/categoria/busca,
  // que só filtram a lista. Mesma fonte da dashboard: os números batem por
  // construção.
  const summaryParams = useMemo(
    () => ({
      kind: 'debit' as const,
      year: filters.year,
      month: filters.month,
      family_member_id: filters.family_member_id || undefined,
    }),
    [filters.year, filters.month, filters.family_member_id]
  )
  const summaryQ = useQuery({
    queryKey: financeKeys.entriesSummary(summaryParams),
    queryFn: () => getEntriesSummary(summaryParams),
  })
  const summary = summaryQ.data
  const monthLabel = MONTH_OPTIONS.find((o) => o.value === filters.month)?.label ?? ''

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (e: Entry) => {
    setEditing(e)
    setFormOpen(true)
  }

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setPage(0) // filtro mudou: resultado novo começa da primeira página
    setFilters((f) => ({ ...f, [key]: value }))
  }

  return (
    <>
      <PageHeader
        title="Despesas"
        subtitle="Lance as despesas da família. Recorrentes viram previstas do ano; confirmar marca como paga."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Nova despesa
          </Button>
        }
      />

      {/* Cards de resumo */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Eixo competência: o que VENCE no mês — é o que a lista abaixo mostra. */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Contas do mês"
            value={formatCents(summary?.due.total_cents ?? 0)}
            hint={
              summary
                ? `${summary.due.total_count} vencem em ${monthLabel} · sem canceladas`
                : 'Carregando…'
            }
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Pago"
            value={formatCents(summary?.due.paid_cents ?? 0)}
            hint={
              summary
                ? `${summary.due.paid_count} de ${summary.due.total_count} · valor pago`
                : 'Carregando…'
            }
            color="error.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="A pagar"
            value={formatCents(summary?.due.open_cents ?? 0)}
            hint={summary ? `${summary.due.open_count} em aberto` : 'Carregando…'}
            color="warning.main"
          />
        </Grid>
        {/* Eixo caixa: o que foi PAGO no mês, qualquer vencimento — o número da dashboard. */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Saiu do caixa"
            value={formatCents(summary?.cash.paid_cents ?? 0)}
            hint={
              summary
                ? `${summary.cash.paid_count} pagamentos em ${monthLabel}, qualquer vencimento · igual à dashboard`
                : 'Carregando…'
            }
          />
        </Grid>
      </Grid>

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setPage(0)
                }}
                placeholder="Buscar por descrição…"
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchRoundedIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                select
                label="Membro"
                fullWidth
                size="small"
                value={filters.family_member_id}
                onChange={(e) => setFilter('family_member_id', e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {(membersQuery.data ?? []).map((m) => (
                  <MenuItem key={m.id} value={m.id}>
                    {m.full_name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}>
              <TextField
                select
                label="Mês"
                fullWidth
                size="small"
                value={filters.month}
                onChange={(e) => setFilter('month', Number(e.target.value))}
              >
                {MONTH_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}>
              <TextField
                select
                label="Ano"
                fullWidth
                size="small"
                value={filters.year}
                onChange={(e) => setFilter('year', Number(e.target.value))}
              >
                {yearsList.map((y) => (
                  <MenuItem key={y} value={y}>
                    {y}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 6, md: 2 }}>
              <TextField
                select
                label="Status"
                fullWidth
                size="small"
                value={filters.status}
                onChange={(e) => setFilter('status', e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {ENTRY_STATUS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6, sm: 6, md: 3 }}>
              <AutocompleteField
                label="Categoria"
                size="small"
                emptyLabel="Todas"
                value={filters.type}
                onChange={(v) => setFilter('type', v)}
                options={activeCategories.map((cat) => ({
                  value: cat.slug,
                  label: cat.name,
                  description: cat.group_name,
                }))}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<TrendingDownRoundedIcon />}
          title="Nenhuma despesa no período"
          description="Ajuste os filtros ou lance uma nova despesa para começar."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Nova despesa
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Data</TableCell>
                  <TableCell>Membro</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Fornecedor</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell align="right">Pago</TableCell>
                  <TableCell>Recorrência</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((e) => {
                  const isInvoice = (e.type as string | null | undefined) === 'cartao'
                  const expandable = isInvoice || Boolean(e.fiscal_document_id)
                  const isOpen = expandedId === e.id
                  return (
                  <Fragment key={e.id}>
                  <TableRow hover>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={0.5}>
                        {expandable ? (
                          <IconButton
                            size="small"
                            onClick={() => setExpandedId(isOpen ? null : e.id)}
                          >
                            {isOpen ? (
                              <KeyboardArrowUpRoundedIcon fontSize="small" />
                            ) : (
                              <KeyboardArrowDownRoundedIcon fontSize="small" />
                            )}
                          </IconButton>
                        ) : null}
                        <span>{formatDateBR(e.due_date)}</span>
                      </Stack>
                    </TableCell>
                    <TableCell>{memberName(e.family_member_id)}</TableCell>
                    <TableCell>{categoryName(e.type)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {supplierName(e.supplier_id) ?? '—'}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatCents(e.amount_cents)}
                      {e.discount_cents ? (
                        <Tooltip
                          title={`Desconto: ${discountReasonName(e.discount_reason)} — pago ${formatCents(e.paid_amount_cents ?? e.amount_cents - e.discount_cents)}`}
                        >
                          <Typography
                            variant="caption"
                            display="block"
                            sx={{ color: 'success.main', fontWeight: 600 }}
                          >
                            −{formatCents(e.discount_cents)}
                          </Typography>
                        </Tooltip>
                      ) : null}
                      {(e.late_fee_cents ?? 0) + (e.late_interest_cents ?? 0) > 0 ? (
                        <Tooltip
                          title={`Juros e multa: multa ${formatCents(e.late_fee_cents ?? 0)} · juros ${formatCents(e.late_interest_cents ?? 0)} — pago ${formatCents(e.paid_amount_cents ?? e.amount_cents)}`}
                        >
                          <Typography
                            variant="caption"
                            display="block"
                            sx={{ color: 'warning.main', fontWeight: 600 }}
                          >
                            +{formatCents((e.late_fee_cents ?? 0) + (e.late_interest_cents ?? 0))}
                          </Typography>
                        </Tooltip>
                      ) : null}
                    </TableCell>
                    <TableCell align="right">
                      {e.status === 'realizada' ? (
                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 700,
                            color:
                              (e.paid_amount_cents ?? e.amount_cents) < e.amount_cents
                                ? 'info.main'
                                : 'success.main',
                          }}
                        >
                          {formatCents(e.paid_amount_cents ?? e.amount_cents)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          —
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {e.parent_id ? (
                        <Tooltip title="Compra dentro de uma fatura de cartão">
                          <Chip size="small" variant="outlined" color="info" label="Fatura" />
                        </Tooltip>
                      ) : e.residual_of_id ? (
                        <Tooltip title="Saldo não pago de um pagamento parcial">
                          <Chip
                            size="small"
                            variant="outlined"
                            color="warning"
                            icon={<CallSplitRoundedIcon />}
                            label="Residual"
                          />
                        </Tooltip>
                      ) : e.fiscal_document_id ? (
                        <Tooltip title="Cupom/nota fiscal vinculado — expanda para ver os itens">
                          <Chip
                            size="small"
                            variant="outlined"
                            color="success"
                            icon={<ReceiptRoundedIcon />}
                            label="Cupom"
                          />
                        </Tooltip>
                      ) : e.installment_total ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          label={`${e.installment_number ?? '?'}/${e.installment_total}`}
                        />
                      ) : e.recurrence !== 'none' ? (
                        <Chip
                          size="small"
                          variant="outlined"
                          icon={<RepeatRoundedIcon />}
                          label={RECURRENCE_LABEL[e.recurrence] ?? e.recurrence}
                        />
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={ENTRY_STATUS_LABEL[e.status] ?? e.status}
                        color={ENTRY_STATUS_COLOR[e.status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver todos os dados">
                        <IconButton size="small" onClick={() => setToDetail(e)}>
                          <VisibilityRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {e.status === 'prevista' && (
                        <Tooltip title="Confirmar pagamento">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() => setToConfirm(e)}
                          >
                            <CheckCircleRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {e.status === 'realizada' && (
                        <Tooltip title="Desfazer pagamento">
                          <IconButton
                            size="small"
                            color="warning"
                            disabled={reopenMutation.isPending}
                            onClick={() => setToReopen(e)}
                          >
                            <UndoRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(e)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {e.status === 'prevista' && (
                        <Tooltip title="Não houve cobrança neste mês">
                          <IconButton size="small" onClick={() => setToWaive(e)}>
                            <MoneyOffRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {e.status !== 'cancelada' && (
                        <Tooltip title="Cancelar">
                          <IconButton
                            size="small"
                            color="warning"
                            onClick={() => setToCancel(e)}
                          >
                            <CancelRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(e)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  {expandable && (
                    <ExpenseDetailRow
                      entry={e}
                      colSpan={8}
                      open={isOpen}
                      categoryLabel={categoryName}
                    />
                  )}
                  </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Divider />
          <TablePaginationBR
            total={data?.total ?? 0}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {formOpen && (
        <EntryFormDialog
          open={formOpen}
          entry={editing}
          onClose={() => setFormOpen(false)}
          onCreatedRecurring={(count) =>
            show(`${count} lançamentos previstos criados até dezembro.`)
          }
        />
      )}

      {toDelete && (
        <DeleteEntryDialog entry={toDelete} kindLabel="despesa" onClose={() => setToDelete(null)} />
      )}

      {toCancel && <CancelEntryDialog entry={toCancel} onClose={() => setToCancel(null)} />}

      {toWaive && <WaiveEntryDialog entry={toWaive} onClose={() => setToWaive(null)} />}

      {toDetail && <EntryDetailDialog entry={toDetail} onClose={() => setToDetail(null)} />}

      {toConfirm && (
        <ConfirmPaymentDialog entry={toConfirm} onClose={() => setToConfirm(null)} />
      )}

      <ConfirmDialog
        open={Boolean(toReopen)}
        title="Desfazer pagamento"
        description={`Desfazer o pagamento de "${toReopen?.description}"? A despesa volta a prevista e os dados de pagamento são limpos.`}
        confirmLabel="Desfazer pagamento"
        cancelLabel="Voltar"
        loading={reopenMutation.isPending}
        onConfirm={() => toReopen && reopenMutation.mutate(toReopen.id)}
        onClose={() => setToReopen(null)}
      />
    </>
  )
}
