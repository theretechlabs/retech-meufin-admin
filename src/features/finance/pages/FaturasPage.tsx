import { useMemo, useState } from 'react'
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
  Grid,
  IconButton,
  InputAdornment,
  Stack,
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
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  confirmEntry,
  reopenEntry,
  createEntry,
  deleteEntry,
  formatCents,
  listCards,
  listEntries,
  reaisToCents,
  type CreditCard,
  type Entry,
  type EntryInput,
  type ListEntriesParams,
} from '../api'
import {
  ENTRY_STATUS_COLOR,
  ENTRY_STATUS_LABEL,
  errorMessage,
  EXPENSE_CATEGORY_LABEL,
  INVOICE_RECURRENCE_OPTIONS,
  financeKeys,
  MONTH_OPTIONS,
} from '../constants'
import { useYearOptions } from '../hooks/useYearOptions'
import { useExpenseCategories } from '../hooks/useExpenseCategories'
import { MoneyField } from '@/components/fields/MoneyField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { numericOptions } from '@/components/fields/options'
import { formatDateBR } from '@/utils/dates'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { ImportInvoiceDialog } from '../components/ImportInvoiceDialog'
import { PurchaseEditDialog } from '../components/PurchaseEditDialog'
import { useToast } from '@/providers/ToastProvider'

const now = new Date()

function todayIso(): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type Filters = {
  card_id: string
  year: number
  month: number
}

const initialFilters: Filters = {
  card_id: '',
  year: now.getFullYear(),
  month: now.getMonth() + 1,
}

// ---------------------------------------------------------------------------
// Dialog: Nova fatura
// ---------------------------------------------------------------------------

type InvoiceFormValues = {
  card_id: string
  due_date: string
  amount: string
  recurrence: 'none' | 'monthly'
  description: string
}

function InvoiceFormDialog({
  open,
  cards,
  defaultCardId,
  onClose,
  onCreatedRecurring,
}: {
  open: boolean
  cards: CreditCard[]
  defaultCardId: string
  onClose: () => void
  onCreatedRecurring: (count: number) => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InvoiceFormValues>({
    values: {
      card_id: defaultCardId || (cards[0]?.id ?? ''),
      due_date: todayIso(),
      amount: '',
      recurrence: 'none',
      description: '',
    },
  })

  const mutation = useMutation({
    mutationFn: async (values: InvoiceFormValues) => {
      const input: EntryInput = {
        kind: 'debit',
        status: 'prevista',
        amount_cents: reaisToCents(values.amount),
        due_date: values.due_date,
        card_id: values.card_id,
        description: values.description.trim() || 'Fatura',
        recurrence: values.recurrence === 'monthly' ? 'monthly' : 'none',
      }
      const res = await createEntry(input)
      return { created: res.total ?? res.items?.length ?? 1 }
    },
    onSuccess: ({ created }) => {
      if (created <= 1) {
        show('Fatura criada com sucesso.')
      }
      qc.invalidateQueries({ queryKey: financeKeys.all })
      reset()
      onClose()
      if (created > 1) onCreatedRecurring(created)
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Nova fatura</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="card_id"
            control={control}
            rules={{ required: 'Selecione o cartão' }}
            render={({ field }) => (
              <AutocompleteField
                label="Cartão"
                required
                value={field.value}
                onChange={field.onChange}
                options={cards.map((c) => ({ value: c.id, label: c.name }))}
                error={Boolean(errors.card_id)}
                helperText={errors.card_id?.message}
              />
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="due_date"
              control={control}
              rules={{ required: 'Informe a data' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Vencimento"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.due_date)}
                  helperText={errors.due_date?.message}
                />
              )}
            />
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
                  label="Valor total"
                  fullWidth
                  required
                  error={Boolean(errors.amount)}
                  helperText={errors.amount?.message}
                />
              )}
            />
          </Stack>
          <Controller
            name="recurrence"
            control={control}
            render={({ field }) => (
              <AutocompleteField
                label="Recorrência"
                value={field.value}
                onChange={field.onChange}
                options={INVOICE_RECURRENCE_OPTIONS}
                disableClearable
              />
            )}
          />
          <Controller
            name="description"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Descrição" fullWidth placeholder="Fatura" />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          Criar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Dialog: Adicionar compra
// ---------------------------------------------------------------------------

type PurchaseFormValues = {
  description: string
  amount: string
  purchase_date: string
  type: string
}

function PurchaseFormDialog({
  open,
  invoice,
  onClose,
}: {
  open: boolean
  invoice: Entry
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const { activeCategories } = useExpenseCategories()

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PurchaseFormValues>({
    values: {
      description: '',
      amount: '',
      purchase_date: invoice.due_date,
      type: 'outros',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: PurchaseFormValues) => {
      const input: EntryInput = {
        kind: 'debit',
        status: 'prevista',
        amount_cents: reaisToCents(values.amount),
        // Vencimento do item é sempre o da fatura; a data escolhida é a da compra.
        due_date: invoice.due_date,
        purchase_date: values.purchase_date || null,
        card_id: invoice.card_id ?? null,
        parent_id: invoice.id,
        type: (values.type || null) as EntryInput['type'],
        description: values.description.trim(),
        recurrence: 'none',
      }
      return createEntry(input)
    },
    onSuccess: () => {
      show('Compra adicionada com sucesso.')
      qc.invalidateQueries({ queryKey: financeKeys.all })
      reset()
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Adicionar compra</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
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
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
                  label="Valor"
                  fullWidth
                  required
                  error={Boolean(errors.amount)}
                  helperText={errors.amount?.message}
                />
              )}
            />
            <Controller
              name="purchase_date"
              control={control}
              rules={{ required: 'Informe a data' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="date"
                  label="Data da compra"
                  fullWidth
                  required
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.purchase_date)}
                  helperText={errors.purchase_date?.message}
                />
              )}
            />
          </Stack>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <AutocompleteField
                label="Categoria"
                value={field.value}
                onChange={field.onChange}
                options={activeCategories.map((cat) => ({
                  value: cat.slug,
                  label: cat.name,
                  description: cat.group_name,
                }))}
                placeholder="Busque por nome ou grupo"
                disableClearable
              />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button onClick={submit} variant="contained" disabled={mutation.isPending}>
          Adicionar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Linha de fatura (expandível com compras)
// ---------------------------------------------------------------------------

function PurchasesRow({
  invoice,
  cardName,
  expanded,
  onToggle,
  onConfirm,
  onReopen,
  onDelete,
  confirmPending,
  reopenPending,
}: {
  invoice: Entry
  cardName: string
  expanded: boolean
  onToggle: () => void
  onConfirm: () => void
  onReopen: () => void
  onDelete: () => void
  confirmPending: boolean
  reopenPending: boolean
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [purchaseOpen, setPurchaseOpen] = useState(false)
  const [toDeletePurchase, setToDeletePurchase] = useState<Entry | null>(null)
  const [toEditPurchase, setToEditPurchase] = useState<Entry | null>(null)

  const purchasesQuery = useQuery({
    queryKey: financeKeys.entries({ parent_id: invoice.id }),
    queryFn: () => listEntries({ parent_id: invoice.id, kind: 'debit', limit: 500 }),
    enabled: expanded,
  })

  const deletePurchase = useMutation({
    mutationFn: (id: string) => deleteEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      setToDeletePurchase(null)
      show('Compra excluída.')
    },
  })

  const purchases = purchasesQuery.data?.items ?? []
  const purchasesTotal = purchases.reduce((acc, p) => acc + p.amount_cents, 0)

  const monthLabel =
    MONTH_OPTIONS.find((m) => m.value === Number(invoice.due_date.slice(5, 7)))?.label ?? ''
  const competencia = `${monthLabel}/${invoice.due_date.slice(0, 4)}`

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton size="small" onClick={onToggle}>
            {expanded ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 600 }}>{cardName}</TableCell>
        <TableCell>{competencia}</TableCell>
        <TableCell>{formatDateBR(invoice.due_date)}</TableCell>
        <TableCell align="right" sx={{ fontWeight: 700 }}>
          {formatCents(invoice.amount_cents)}
        </TableCell>
        <TableCell>
          {invoice.installment_total ? (
            <Chip
              size="small"
              variant="outlined"
              label={`${invoice.installment_number ?? '?'}/${invoice.installment_total}`}
            />
          ) : (
            '—'
          )}
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={ENTRY_STATUS_LABEL[invoice.status] ?? invoice.status}
            color={ENTRY_STATUS_COLOR[invoice.status] ?? 'default'}
          />
        </TableCell>
        <TableCell align="right">
          {invoice.status === 'prevista' && (
            <Tooltip title="Confirmar (marcar como paga)">
              <IconButton
                size="small"
                color="success"
                disabled={confirmPending}
                onClick={onConfirm}
              >
                <CheckCircleRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {invoice.status === 'realizada' && (
            <Tooltip title="Desfazer pagamento">
              <IconButton
                size="small"
                color="warning"
                disabled={reopenPending}
                onClick={onReopen}
              >
                <UndoRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Excluir fatura">
            <IconButton size="small" color="error" onClick={onDelete}>
              <DeleteOutlineRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell colSpan={8} sx={{ py: 0, borderBottom: expanded ? undefined : 'none' }}>
          <Collapse in={expanded} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2 }}>
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Compras da fatura
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddRoundedIcon />}
                  onClick={() => setPurchaseOpen(true)}
                >
                  Adicionar compra
                </Button>
              </Stack>

              {purchasesQuery.isLoading ? (
                <LoadingState />
              ) : purchasesQuery.isError ? (
                <ErrorState
                  message={errorMessage(purchasesQuery.error)}
                  onRetry={purchasesQuery.refetch}
                />
              ) : purchases.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                  Nenhuma compra lançada nesta fatura.
                </Typography>
              ) : (
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
                    {purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.purchase_date ? formatDateBR(p.purchase_date) : '—'}</TableCell>
                        <TableCell>{p.description}</TableCell>
                        <TableCell>
                          {p.type ? EXPENSE_CATEGORY_LABEL[p.type] ?? p.type : '—'}
                        </TableCell>
                        <TableCell align="right">{formatCents(p.amount_cents)}</TableCell>
                        <TableCell align="right">
                          <Tooltip title="Editar compra">
                            <IconButton size="small" onClick={() => setToEditPurchase(p)}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir compra">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => setToDeletePurchase(p)}
                            >
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              <Divider sx={{ mt: 1.5 }} />
              <Stack direction="row" spacing={3} sx={{ pt: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Soma das compras: <strong>{formatCents(purchasesTotal)}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Valor da fatura: <strong>{formatCents(invoice.amount_cents)}</strong>
                </Typography>
                {purchases.length > 0 && purchasesTotal !== invoice.amount_cents && (
                  <Typography variant="caption" color="warning.main">
                    Diferença: {formatCents(Math.abs(purchasesTotal - invoice.amount_cents))}
                  </Typography>
                )}
              </Stack>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>

      {purchaseOpen && (
        <PurchaseFormDialog
          open={purchaseOpen}
          invoice={invoice}
          onClose={() => setPurchaseOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDeletePurchase)}
        title="Excluir compra"
        description={`Excluir "${toDeletePurchase?.description}"? Esta ação não pode ser desfeita.`}
        loading={deletePurchase.isPending}
        onConfirm={() => toDeletePurchase && deletePurchase.mutate(toDeletePurchase.id)}
        onClose={() => setToDeletePurchase(null)}
      />

      {toEditPurchase && (
        <PurchaseEditDialog purchase={toEditPurchase} onClose={() => setToEditPurchase(null)} />
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FaturasPage() {
  const yearsList = useYearOptions()
  const qc = useQueryClient()
  const { show } = useToast()
  const [filters, setFilters] = useState<Filters>(initialFilters)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Entry | null>(null)
  const [toReopen, setToReopen] = useState<Entry | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const cardsQuery = useQuery({
    queryKey: financeKeys.cards(),
    queryFn: listCards,
  })
  const cards = useMemo(() => cardsQuery.data ?? [], [cardsQuery.data])
  const cardName = (id?: string | null) => cards.find((c) => c.id === id)?.name ?? '—'

  const listParams: ListEntriesParams = useMemo(() => {
    const p: ListEntriesParams = {
      kind: 'debit',
      top_level: true,
      year: filters.year,
      month: filters.month,
      limit: pageSize,
      offset: page * pageSize,
    }
    if (filters.card_id) p.card_id = filters.card_id
    if (query.trim()) p.query = query.trim()
    return p
  }, [filters, query, page, pageSize])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: financeKeys.invoices(listParams as Record<string, unknown>),
    queryFn: () => listEntries(listParams),
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show('Fatura confirmada como paga.')
    },
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      setToDelete(null)
      show('Fatura excluída.')
    },
  })
  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      setToReopen(null)
      show('Pagamento desfeito. Fatura voltou a prevista.')
    },
  })

  // Só faturas (card_id setado). O backend com top_level já filtra, mas garantimos aqui.
  const invoices = useMemo(
    () => (data?.items ?? []).filter((e) => Boolean(e.card_id)),
    [data]
  )

  const totalFaturas = useMemo(
    () => invoices.reduce((acc, i) => acc + i.amount_cents, 0),
    [invoices]
  )

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setPage(0) // filtro mudou: volta pra primeira página
    setFilters((f) => ({ ...f, [key]: value }))
  }

  const noCards = !cardsQuery.isLoading && cards.length === 0

  return (
    <>
      <PageHeader
        title="Faturas"
        subtitle="Controle as faturas dos cartões e as compras de cada uma."
        action={
          <>
            <Button
              variant="outlined"
              startIcon={<UploadFileRoundedIcon />}
              onClick={() => setImportOpen(true)}
              disabled={noCards}
            >
              Importar PDF
            </Button>
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setFormOpen(true)}
              disabled={noCards}
            >
              Nova fatura
            </Button>
          </>
        }
      />

      {noCards && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Cadastre um cartão antes de lançar faturas.
        </Alert>
      )}

      {/* Filtros */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <AutocompleteField
                label="Cartão"
                size="small"
                emptyLabel="Todos"
                value={filters.card_id}
                onChange={(v) => setFilter('card_id', v)}
                options={cards.map((c) => ({ value: c.id, label: c.name }))}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}>
              <AutocompleteField
                label="Mês"
                size="small"
                value={String(filters.month)}
                onChange={(v) => setFilter('month', Number(v))}
                options={numericOptions(MONTH_OPTIONS)}
                disableClearable
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3, md: 2 }}>
              <AutocompleteField
                label="Ano"
                size="small"
                value={String(filters.year)}
                onChange={(v) => setFilter('year', Number(v))}
                options={numericOptions(yearsList)}
                disableClearable
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : invoices.length === 0 ? (
        <EmptyState
          icon={<ReceiptLongRoundedIcon />}
          title="Nenhuma fatura no período"
          description="Ajuste os filtros ou lance uma nova fatura para começar."
          action={
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => setFormOpen(true)}
              disabled={noCards}
            >
              Nova fatura
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell>Cartão</TableCell>
                  <TableCell>Competência</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Parcela</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <PurchasesRow
                    key={inv.id}
                    invoice={inv}
                    cardName={cardName(inv.card_id)}
                    expanded={expanded === inv.id}
                    onToggle={() => setExpanded((cur) => (cur === inv.id ? null : inv.id))}
                    onConfirm={() => confirmMutation.mutate(inv.id)}
                    onReopen={() => setToReopen(inv)}
                    onDelete={() => setToDelete(inv)}
                    confirmPending={confirmMutation.isPending}
                    reopenPending={reopenMutation.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Divider />
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ pl: 2, flexWrap: 'wrap' }}
          >
            <Typography variant="caption" color="text.secondary">
              Total do período: {formatCents(totalFaturas)}
            </Typography>
            <TablePaginationBR
              total={data?.total ?? 0}
              page={page}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </Stack>
        </Card>
      )}

      {formOpen && (
        <InvoiceFormDialog
          open={formOpen}
          cards={cards}
          defaultCardId={filters.card_id}
          onClose={() => setFormOpen(false)}
          onCreatedRecurring={(count) =>
            show(`${count} faturas previstas criadas até dezembro.`)
          }
        />
      )}

      {importOpen && (
        <ImportInvoiceDialog
          open={importOpen}
          cards={cards}
          defaultCardId={filters.card_id}
          onClose={() => setImportOpen(false)}
          onConfirmed={(message) => show(message)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir fatura"
        description={`Excluir a fatura de "${cardName(toDelete?.card_id)}"? As compras vinculadas também serão removidas. Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(toReopen)}
        title="Desfazer pagamento"
        description={`Desfazer o pagamento da fatura de "${cardName(toReopen?.card_id)}"? A fatura e as compras vinculadas voltam a previstas.`}
        confirmLabel="Desfazer pagamento"
        cancelLabel="Voltar"
        loading={reopenMutation.isPending}
        onConfirm={() => toReopen && reopenMutation.mutate(toReopen.id)}
        onClose={() => setToReopen(null)}
      />
    </>
  )
}
