import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  FormControlLabel,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import { WaiveEntryDialog } from '../components/WaiveEntryDialog'
import { CancelEntryDialog } from '../components/CancelEntryDialog'
import UndoRoundedIcon from '@mui/icons-material/UndoRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import {
  confirmEntry,
  reopenEntry,
  createEntry,
  createIncomeSource,
  formatCents,
  getEntriesSummary,
  listEntries,
  listFamilyMembers,
  listIncomeSources,
  reaisToCents,
  updateEntry,
  type Entry,
  type EntryInput,
  type IncomeSource,
  type ListEntriesParams,
} from '../api'
import {
  ENTRY_STATUS_COLOR,
  ENTRY_STATUS_LABEL,
  ENTRY_STATUS_OPTIONS,
  errorMessage,
  financeKeys,
  INCOME_TYPE_LABEL,
  INCOME_TYPE_OPTIONS,
  SOURCE_KIND_LABEL,
  SOURCE_KIND_TO_INCOME_TYPE,
  MONTH_OPTIONS,
  RECURRENCE_LABEL,
  RECURRENCE_OPTIONS,
  SOURCE_KIND_OPTIONS,
  seriesToast } from '../constants'
import { useYearOptions } from '../hooks/useYearOptions'
import { MoneyField } from '@/components/fields/MoneyField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { formatDateBR } from '@/utils/dates'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { DeleteEntryDialog } from '../components/DeleteEntryDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

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
  source_id: string
  confirm_past: boolean
  type: string
  amount: string // reais
  due_date: string
  recurrence: EntryInput['recurrence']
  description: string
  notes: string
  apply_to_future: boolean
}

function emptyEntryForm(): EntryFormValues {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return {
    family_member_id: '',
    source_id: '',
    confirm_past: false,
    type: 'salario',
    amount: '',
    due_date: `${y}-${m}-${d}`,
    recurrence: 'none',
    description: '',
    notes: '',
    apply_to_future: false,
  }
}

// ---------------------------------------------------------------------------
// Quick-create source mini form
// ---------------------------------------------------------------------------

function QuickSourceForm({
  onCreated,
  onCancel,
}: {
  onCreated: (source: IncomeSource) => void
  onCancel: () => void
}) {
  const qc = useQueryClient()
  const { control, handleSubmit } = useForm<{ name: string; kind: IncomeSource['kind'] }>({
    defaultValues: { name: '', kind: 'clt' },
  })

  const mutation = useMutation({
    mutationFn: (values: { name: string; kind: IncomeSource['kind'] }) =>
      createIncomeSource({ name: values.name.trim(), kind: values.kind, active: true }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: financeKeys.incomeSources() })
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
        Criar fonte rápida
      </Typography>
      {mutation.isError && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {errorMessage(mutation.error)}
        </Alert>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-start">
        <Controller
          name="name"
          control={control}
          render={({ field }) => <TextField {...field} label="Nome" size="small" fullWidth />}
        />
        <Controller
          name="kind"
          control={control}
          render={({ field }) => (
            <TextField {...field} select label="Tipo" size="small" sx={{ minWidth: 160 }}>
              {SOURCE_KIND_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="contained" onClick={submit} disabled={mutation.isPending}>
            Salvar
          </Button>
          <Button size="small" color="inherit" onClick={onCancel} disabled={mutation.isPending}>
            Cancelar
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Entry form dialog
// ---------------------------------------------------------------------------

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
  const [quickSource, setQuickSource] = useState(false)

  const membersQuery = useQuery({
    queryKey: financeKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })
  const sourcesQuery = useQuery({
    queryKey: financeKeys.incomeSources(),
    queryFn: listIncomeSources,
  })

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
          source_id: entry.source_id ?? '',
          confirm_past: false,
          type: entry.type ?? 'salario',
          amount: (entry.amount_cents / 100).toFixed(2).replace('.', ','),
          due_date: entry.due_date,
          recurrence: entry.recurrence,
          description: entry.description,
          notes: entry.notes ?? '',
          apply_to_future: false,
        }
      : emptyEntryForm(),
  })

  const recurrence = useWatch({ control, name: 'recurrence' })
  const dueDateText = useWatch({ control, name: 'due_date' })
  const applyToFuture = useWatch({ control, name: 'apply_to_future' })
  const editDueDate = useWatch({ control, name: 'due_date' })
  const dueDateDirty = Boolean(isEdit && entry && editDueDate && editDueDate !== entry.due_date)
  const isPastDate = useMemo(() => {
    if (!dueDateText) return false
    return dueDateText < new Date().toISOString().slice(0, 10)
  }, [dueDateText])

  const mutation = useMutation({
    mutationFn: async (values: EntryFormValues) => {
      const base: EntryInput = {
        kind: 'credit',
        status: entry?.status ?? 'prevista',
        amount_cents: reaisToCents(values.amount),
        due_date: values.due_date,
        family_member_id: values.family_member_id || null,
        source_id: values.source_id || null,
        confirm_past_occurrences: !isEdit && values.confirm_past ? true : undefined,
        type: (values.type || null) as EntryInput['type'],
        description: values.description.trim(),
        recurrence: values.recurrence,
        notes: values.notes.trim() || null,
      }
      if (isEdit) {
        if (values.apply_to_future) base.apply_to = 'future'
        const updated = await updateEntry(entry!.id, base)
        return {
          created: 0,
          appliedToFuture: values.apply_to_future,
          dueDatesUpdated: updated.series_due_dates_updated ?? 0,
          fieldsUpdated: updated.series_fields_updated ?? 0,
          newDueDay: Number(values.due_date.slice(8, 10)) || null,
        }
      }
      const res = await createEntry(base)
      return {
        created: res.total ?? res.items?.length ?? 1,
        appliedToFuture: false,
        dueDatesUpdated: 0,
        fieldsUpdated: 0,
        newDueDay: null,
      }
    },
    onSuccess: ({ created, appliedToFuture, dueDatesUpdated, fieldsUpdated, newDueDay }) => {
      if (isEdit) {
        show(seriesToast('Receita', appliedToFuture, dueDatesUpdated, fieldsUpdated, newDueDay, false))
      } else if (created <= 1) {
        show('Receita criada com sucesso.')
      }
      qc.invalidateQueries({ queryKey: financeKeys.all })
      reset(emptyEntryForm())
      onClose()
      if (!isEdit && created > 1) onCreatedRecurring(created)
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar receita' : 'Nova receita'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

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

          <Stack spacing={1}>
            <Controller
              name="source_id"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Fonte de receita"
                  emptyLabel="Não atribuída"
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v)
                    // Sugere o tipo pela natureza da fonte (pj → Remuneração PJ,
                    // rental → Aluguel...). O usuário pode trocar depois.
                    const src = (sourcesQuery.data ?? []).find((s) => s.id === v)
                    const suggested = src ? SOURCE_KIND_TO_INCOME_TYPE[src.kind] : undefined
                    if (suggested) setValue('type', suggested)
                  }}
                  options={(sourcesQuery.data ?? []).map((s) => ({
                    value: s.id,
                    label: s.name,
                    description: SOURCE_KIND_LABEL[s.kind],
                  }))}
                />
              )}
            />
            {quickSource ? (
              <QuickSourceForm
                onCreated={(created) => {
                  setValue('source_id', created.id)
                  setQuickSource(false)
                }}
                onCancel={() => setQuickSource(false)}
              />
            ) : (
              <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setQuickSource(true)}>
                Criar fonte rápida
              </Button>
            )}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Tipo"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  options={INCOME_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
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
                  label="Valor"
                  fullWidth
                  required
                  error={Boolean(errors.amount)}
                  helperText={errors.amount?.message}
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
                <TextField {...field} select label="Recorrência" fullWidth disabled={isEdit}>
                  {RECURRENCE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          </Stack>

          {!isEdit && recurrence !== 'none' && (
            <Alert severity="info" icon={<RepeatRoundedIcon />}>
              Ao salvar, o sistema gera os lançamentos <strong>previstos</strong> dos próximos 12
              meses — e mantém sempre 1 ano à frente. Para encerrar a recorrência, cancele a
              ocorrência mais recente.
            </Alert>
          )}

          {!isEdit && recurrence !== 'none' && isPastDate && (
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
                  label="Lançamentos já vencidos foram recebidos (nascem como realizados)"
                />
              )}
            />
          )}

          {isEdit && entry?.recurrence_group_id && !entry?.installment_number && dueDateDirty && !applyToFuture && (
            <Alert severity="warning" icon={<RepeatRoundedIcon />}>
              A data de vencimento mudou, mas com a opção abaixo desligada a alteração
              vale <strong>só para este lançamento</strong>. Para mover também as
              próximas ocorrências, ligue &quot;Aplicar às próximas&quot;.
            </Alert>
          )}

          {isEdit && entry?.recurrence_group_id && !entry?.installment_number && (
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
                    label="Aplicar às próximas ocorrências desta recorrência"
                  />
                )}
              />
              {applyToFuture && (
                <Alert severity="info" icon={<RepeatRoundedIcon />}>
                  <strong>Data de vencimento</strong>: o novo dia é aplicado às ocorrências{' '}
                  <strong>desta em diante</strong> (inclusive realizadas), cada uma no seu mês —
                  as anteriores preservam o vencimento histórico. Valor, descrição e categoria:
                  apenas nas previstas futuras. Canceladas ficam de fora.
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

export default function ReceitasPage() {
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
  const [toReopen, setToReopen] = useState<Entry | null>(null)

  const membersQuery = useQuery({
    queryKey: financeKeys.familyMembers(),
    queryFn: listFamilyMembers,
  })
  const sourcesQuery = useQuery({
    queryKey: financeKeys.incomeSources(),
    queryFn: listIncomeSources,
  })

  const listParams: ListEntriesParams = useMemo(() => {
    const p: ListEntriesParams = {
      kind: 'credit',
      year: filters.year,
      month: filters.month,
      limit: pageSize,
      offset: page * pageSize,
    }
    if (filters.family_member_id) p.family_member_id = filters.family_member_id
    if (filters.status) p.status = filters.status as ListEntriesParams['status']
    if (filters.type) p.type = filters.type as ListEntriesParams['type']
    if (query.trim()) p.query = query.trim()
    return p
  }, [filters, query, page, pageSize])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: financeKeys.entries(listParams as Record<string, unknown>),
    queryFn: () => listEntries(listParams),
  })

  const confirmMutation = useMutation({
    mutationFn: (id: string) => confirmEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show('Receita confirmada como recebida.')
    },
  })
  const reopenMutation = useMutation({
    mutationFn: (id: string) => reopenEntry(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      setToReopen(null)
      show('Recebimento desfeito. Receita voltou a prevista.')
    },
  })

  const entries = useMemo(() => data?.items ?? [], [data])

  const memberName = (id?: string | null) =>
    (membersQuery.data ?? []).find((m) => m.id === id)?.full_name ?? '—'
  const sourceName = (id?: string | null) =>
    (sourcesQuery.data ?? []).find((s) => s.id === id)?.name ?? '—'

  // Cards vêm da API, nos dois eixos, pelo mês/ano/membro — NÃO somam a
  // página visível (paginada em {pageSize}) e ignoram status/categoria/busca,
  // que só filtram a lista. Mesma fonte da dashboard: os números batem por
  // construção.
  const summaryParams = useMemo(
    () => ({
      kind: 'credit' as const,
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
        title="Receitas"
        subtitle="Lance as receitas da família. Recorrentes mantêm 12 meses de previstos à frente; confirmar marca como recebido."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Nova receita
          </Button>
        }
      />

      {/* Cards de resumo */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Eixo competência: o que VENCE no mês — é o que a lista abaixo mostra. */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Receitas do mês"
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
            label="Recebido"
            value={formatCents(summary?.due.paid_cents ?? 0)}
            hint={
              summary
                ? `${summary.due.paid_count} de ${summary.due.total_count} · valor pago`
                : 'Carregando…'
            }
            color="success.main"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="A receber"
            value={formatCents(summary?.due.open_cents ?? 0)}
            hint={summary ? `${summary.due.open_count} em aberto` : 'Carregando…'}
            color="warning.main"
          />
        </Grid>
        {/* Eixo caixa: o que foi PAGO no mês, qualquer vencimento — o número da dashboard. */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            label="Entrou no caixa"
            value={formatCents(summary?.cash.paid_cents ?? 0)}
            hint={
              summary
                ? `${summary.cash.paid_count} recebimentos em ${monthLabel}, qualquer vencimento · igual à dashboard`
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
              <TextField
                select
                label="Tipo"
                fullWidth
                size="small"
                value={filters.type}
                onChange={(e) => setFilter('type', e.target.value)}
              >
                <MenuItem value="">Todos</MenuItem>
                {INCOME_TYPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
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
          icon={<PaymentsRoundedIcon />}
          title="Nenhuma receita no período"
          description="Ajuste os filtros ou lance uma nova receita para começar."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Nova receita
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
                  <TableCell>Fonte</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Recorrência</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} hover>
                    <TableCell>{formatDateBR(e.due_date)}</TableCell>
                    <TableCell>{memberName(e.family_member_id)}</TableCell>
                    <TableCell>{sourceName(e.source_id)}</TableCell>
                    <TableCell>{e.type ? INCOME_TYPE_LABEL[e.type] ?? e.type : '—'}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 700 }}>
                      {formatCents(e.amount_cents)}
                    </TableCell>
                    <TableCell>
                      {e.recurrence !== 'none' ? (
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
                      {e.status === 'prevista' && (
                        <Tooltip title="Confirmar recebimento">
                          <IconButton
                            size="small"
                            color="success"
                            disabled={confirmMutation.isPending}
                            onClick={() => confirmMutation.mutate(e.id)}
                          >
                            <CheckCircleRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {e.status === 'realizada' && (
                        <Tooltip title="Desfazer recebimento">
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
                        <Tooltip title="Não houve recebimento neste mês">
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
                ))}
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
            show(`${count} lançamentos previstos criados (próximos 12 meses).`)
          }
        />
      )}

      {toDelete && (
        <DeleteEntryDialog entry={toDelete} kindLabel="receita" onClose={() => setToDelete(null)} />
      )}

      {toCancel && <CancelEntryDialog entry={toCancel} onClose={() => setToCancel(null)} />}

      {toWaive && <WaiveEntryDialog entry={toWaive} onClose={() => setToWaive(null)} />}

      <ConfirmDialog
        open={Boolean(toReopen)}
        title="Desfazer recebimento"
        description={`Desfazer o recebimento de "${toReopen?.description}"? A receita volta a prevista e os dados de recebimento são limpos.`}
        confirmLabel="Desfazer recebimento"
        cancelLabel="Voltar"
        loading={reopenMutation.isPending}
        onConfirm={() => toReopen && reopenMutation.mutate(toReopen.id)}
        onClose={() => setToReopen(null)}
      />
    </>
  )
}
