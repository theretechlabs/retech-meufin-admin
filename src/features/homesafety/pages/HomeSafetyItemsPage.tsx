import { useCallback, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
import LibraryAddRoundedIcon from '@mui/icons-material/LibraryAddRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { MoneyField } from '@/components/fields/MoneyField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import {
  createHomeSafetyEvent,
  createHomeSafetyItem,
  deleteHomeSafetyEvent,
  deleteHomeSafetyItem,
  getHomeSafetyCatalog,
  listHomeSafetyEvents,
  listHomeSafetyItems,
  updateHomeSafetyItem,
  type HomeSafetyCatalogEntry,
  type HomeSafetyEventInput,
  type HomeSafetyItem,
  type HomeSafetyItemInput,
} from '../api'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import {
  PRIORITY_COLOR,
  STATUS_COLOR,
  errorMessage,
  formatCents,
  formatDate,
  formatDaysUntil,
  formatMonths,
  homeSafetyKeys,
} from '../constants'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

// ─── Form helpers ─────────────────────────────────────────────────────────────

type FormValues = {
  name: string
  category: string
  risk_type: string
  location: string
  brand: string
  model: string
  installed_at: string
  lifespan_months: string
  service_interval_months: string
  last_service_at: string
  priority: string
  responsible: string
  last_cost: string
  active: boolean
  notes: string
}

const emptyForm: FormValues = {
  name: '',
  category: 'outros',
  risk_type: 'outros',
  location: '',
  brand: '',
  model: '',
  installed_at: '',
  lifespan_months: '',
  service_interval_months: '',
  last_service_at: '',
  priority: 'media',
  responsible: '',
  last_cost: '',
  active: true,
  notes: '',
}

function itemToForm(i: HomeSafetyItem): FormValues {
  return {
    name: i.name,
    category: i.category,
    risk_type: i.risk_type,
    location: i.location ?? '',
    brand: i.brand ?? '',
    model: i.model ?? '',
    installed_at: i.installed_at ?? '',
    lifespan_months: i.lifespan_months != null ? String(i.lifespan_months) : '',
    service_interval_months: i.service_interval_months != null ? String(i.service_interval_months) : '',
    last_service_at: i.last_service_at ?? '',
    priority: i.priority,
    responsible: i.responsible ?? '',
    last_cost: i.last_cost_cents ? String(i.last_cost_cents) : '',
    active: i.active,
    notes: i.notes ?? '',
  }
}

function reaisStringToCents(v: string): number {
  if (!v.trim()) return 0
  const reais = parseFloat(v.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(reais) ? Math.round(reais * 100) : 0
}

function optionalInt(v: string): number | null {
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function formToInput(v: FormValues): HomeSafetyItemInput {
  return {
    name: v.name.trim(),
    category: v.category as HomeSafetyItemInput['category'],
    risk_type: v.risk_type as HomeSafetyItemInput['risk_type'],
    location: v.location.trim() || null,
    brand: v.brand.trim() || null,
    model: v.model.trim() || null,
    installed_at: v.installed_at || null,
    lifespan_months: optionalInt(v.lifespan_months),
    service_interval_months: optionalInt(v.service_interval_months),
    last_service_at: v.last_service_at || null,
    priority: v.priority as HomeSafetyItemInput['priority'],
    responsible: v.responsible.trim() || null,
    last_cost_cents: reaisStringToCents(v.last_cost),
    active: v.active,
    notes: v.notes.trim() || null,
  }
}

// ─── Item form dialog ─────────────────────────────────────────────────────────

function ItemFormDialog({
  open,
  item,
  onClose,
}: {
  open: boolean
  item: HomeSafetyItem | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(item)
  const category = useCatalog('homesafety.category')
  const riskType = useCatalog('homesafety.risk_type')
  const priority = useCatalog('homesafety.priority')

  const { control, handleSubmit, reset } = useForm<FormValues>({
    values: item ? itemToForm(item) : emptyForm,
  })

  const mutation = useMutation({
    mutationFn: useCallback(
      (values: FormValues) => {
        const input = formToInput(values)
        if (isEdit && item) return updateHomeSafetyItem(item.id, input)
        return createHomeSafetyItem(input)
      },
      [isEdit, item],
    ),
    onSuccess: () => {
      show(isEdit ? 'Item atualizado com sucesso.' : 'Item cadastrado com sucesso.')
      qc.invalidateQueries({ queryKey: homeSafetyKeys.all })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Editar item' : 'Novo item de segurança'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome' }}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nome do item"
                fullWidth
                required
                placeholder="Ex: Extintor da garagem"
                error={Boolean(fieldState.error)}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="category"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Categoria"
                  value={field.value}
                  onChange={field.onChange}
                  options={category.options}
                  loading={category.isLoading}
                  disableClearable
                />
              )}
            />
            <Controller
              name="risk_type"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Tipo de risco"
                  value={field.value}
                  onChange={field.onChange}
                  options={riskType.options}
                  loading={riskType.isLoading}
                  disableClearable
                />
              )}
            />
            <Controller
              name="priority"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Prioridade"
                  value={field.value}
                  onChange={field.onChange}
                  options={priority.options}
                  loading={priority.isLoading}
                  disableClearable
                  fullWidth={false}
                  sx={{ minWidth: 140 }}
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="location"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Local" fullWidth placeholder="Ex: Cozinha" />
              )}
            />
            <Controller
              name="responsible"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Responsável" fullWidth placeholder="Quem cuida" />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="brand"
              control={control}
              render={({ field }) => <TextField {...field} label="Marca" fullWidth />}
            />
            <Controller
              name="model"
              control={control}
              render={({ field }) => <TextField {...field} label="Modelo" fullWidth />}
            />
          </Stack>

          <Divider />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            VALIDADE E MANUTENÇÃO
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="installed_at"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Instalado em"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
            <Controller
              name="lifespan_months"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Validade (meses)"
                  type="number"
                  fullWidth
                  inputProps={{ min: 0 }}
                  helperText="Deixe vazio se não expira"
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="service_interval_months"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Periodicidade de manutenção (meses)"
                  type="number"
                  fullWidth
                  inputProps={{ min: 0 }}
                  helperText="Ex: 6 = a cada semestre"
                />
              )}
            />
            <Controller
              name="last_service_at"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Última manutenção"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
            <Controller
              name="last_cost"
              control={control}
              render={({ field }) => <MoneyField {...field} label="Último custo" fullWidth />}
            />
          </Stack>

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
          {isEdit ? 'Salvar' : 'Cadastrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Catalog dialog ───────────────────────────────────────────────────────────

function CatalogDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const category = useCatalog('homesafety.category')
  const priority = useCatalog('homesafety.priority')
  const qc = useQueryClient()
  const { show } = useToast()
  const [selected, setSelected] = useState<Record<string, boolean>>({})

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: homeSafetyKeys.catalog(),
    queryFn: getHomeSafetyCatalog,
    enabled: open,
  })

  const toggle = (key: string) => setSelected((prev) => ({ ...prev, [key]: !prev[key] }))

  const mutation = useMutation({
    mutationFn: async (entries: HomeSafetyCatalogEntry[]) => {
      for (const e of entries) {
        await createHomeSafetyItem({
          name: e.name,
          category: e.category,
          risk_type: e.risk_type,
          location: e.default_location && e.default_location !== '—' ? e.default_location : null,
          lifespan_months: e.lifespan_months ?? null,
          service_interval_months: e.service_interval_months ?? null,
          priority: e.priority,
          notes: e.notes || null,
        })
      }
    },
    onSuccess: (_r, entries) => {
      show(`${entries.length} ${entries.length === 1 ? 'item adicionado' : 'itens adicionados'} do catálogo.`)
      qc.invalidateQueries({ queryKey: homeSafetyKeys.all })
      setSelected({})
      onClose()
    },
  })

  const chosen = useMemo(() => (data ?? []).filter((e) => selected[e.key]), [data, selected])

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Adicionar do catálogo</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Selecione os itens sugeridos. Você poderá ajustar validade, datas e local depois.
        </Typography>
        {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message={errorMessage(error)} onRetry={refetch} />
        ) : (
          <List dense sx={{ maxHeight: 420, overflow: 'auto' }}>
            {(data ?? []).map((e) => (
              <ListItemButton key={e.key} onClick={() => toggle(e.key)} sx={{ borderRadius: 1 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox edge="start" checked={Boolean(selected[e.key])} tabIndex={-1} disableRipple />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography variant="body2" fontWeight={600}>
                        {e.name}
                      </Typography>
                      <Chip size="small" variant="outlined" label={category.labelOf(e.category)} sx={{ fontSize: 10 }} />
                      <Chip
                        size="small"
                        color={PRIORITY_COLOR[e.priority]}
                        label={priority.labelOf(e.priority)}
                        sx={{ fontSize: 10 }}
                      />
                    </Stack>
                  }
                  secondary={
                    [
                      e.lifespan_months ? `Validade ${formatMonths(e.lifespan_months)}` : '',
                      e.service_interval_months ? `Revisão ${formatMonths(e.service_interval_months)}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ') || e.notes
                  }
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          onClick={() => mutation.mutate(chosen)}
          variant="contained"
          disabled={mutation.isPending || chosen.length === 0}
        >
          Adicionar {chosen.length > 0 ? `(${chosen.length})` : ''}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Events (history) dialog ──────────────────────────────────────────────────

type EventForm = {
  event_type: string
  event_date: string
  cost: string
  provider: string
  notes: string
}

const emptyEventForm: EventForm = {
  event_type: 'manutencao',
  event_date: new Date().toISOString().slice(0, 10),
  cost: '',
  provider: '',
  notes: '',
}

function EventsDialog({ item, onClose }: { item: HomeSafetyItem; onClose: () => void }) {
  const qc = useQueryClient()
  const { show } = useToast()
  const eventType = useCatalog('homesafety.event_type')
  const { control, handleSubmit, reset } = useForm<EventForm>({ defaultValues: emptyEventForm })

  const eventsQuery = useQuery({
    queryKey: homeSafetyKeys.events(item.id),
    queryFn: () => listHomeSafetyEvents(item.id),
  })

  const createMutation = useMutation({
    mutationFn: (v: EventForm) =>
      createHomeSafetyEvent(item.id, {
        event_type: v.event_type as HomeSafetyEventInput['event_type'],
        event_date: v.event_date,
        cost_cents: reaisStringToCents(v.cost),
        provider: v.provider.trim() || null,
        notes: v.notes.trim() || null,
      }),
    onSuccess: () => {
      show('Evento registrado. Vencimento atualizado.')
      qc.invalidateQueries({ queryKey: homeSafetyKeys.events(item.id) })
      qc.invalidateQueries({ queryKey: homeSafetyKeys.all })
      reset(emptyEventForm)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (eventId: string) => deleteHomeSafetyEvent(item.id, eventId),
    onSuccess: () => {
      show('Evento removido.')
      qc.invalidateQueries({ queryKey: homeSafetyKeys.events(item.id) })
      qc.invalidateQueries({ queryKey: homeSafetyKeys.all })
    },
  })

  const submit = handleSubmit((v) => createMutation.mutate(v))
  const events = eventsQuery.data ?? []

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Histórico · {item.name}
        <Typography variant="body2" color="text.secondary">
          Próximo vencimento: {formatDate(item.next_due_date)} ({formatDaysUntil(item.days_until_due)})
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          REGISTRAR EVENTO
        </Typography>
        {createMutation.isError && <ErrorState message={errorMessage(createMutation.error)} />}
        <Stack spacing={2} sx={{ mt: 1.5, mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="event_type"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Tipo"
                  value={field.value}
                  onChange={field.onChange}
                  options={eventType.options}
                  loading={eventType.isLoading}
                  disableClearable
                />
              )}
            />
            <Controller
              name="event_date"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Data"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="cost"
              control={control}
              render={({ field }) => <MoneyField {...field} label="Custo" fullWidth />}
            />
            <Controller
              name="provider"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Prestador" fullWidth placeholder="Empresa/profissional" />
              )}
            />
          </Stack>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => <TextField {...field} label="Observações" fullWidth />}
          />
          <Button
            onClick={submit}
            variant="contained"
            startIcon={<AddRoundedIcon />}
            disabled={createMutation.isPending}
            sx={{ alignSelf: 'flex-start' }}
          >
            Registrar
          </Button>
        </Stack>

        <Divider sx={{ mb: 1.5 }} />
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          EVENTOS
        </Typography>

        {eventsQuery.isLoading ? (
          <LoadingState />
        ) : events.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
            Nenhum evento registrado ainda.
          </Typography>
        ) : (
          <Stack spacing={0.5} sx={{ mt: 1 }}>
            {events.map((e) => (
              <Stack
                key={e.id}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={1}
                sx={{ px: 1, py: 0.75, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {eventType.labelOf(e.event_type)} · {formatDate(e.event_date)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {[e.cost_cents ? formatCents(e.cost_cents) : '', e.provider, e.notes]
                      .filter(Boolean)
                      .join(' · ') || 'Sem detalhes'}
                  </Typography>
                </Box>
                <Tooltip title="Remover evento">
                  <IconButton
                    size="small"
                    color="error"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(e.id)}
                  >
                    <DeleteOutlineRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomeSafetyItemsPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const category = useCatalog('homesafety.category')
  const riskType = useCatalog('homesafety.risk_type')
  const priority = useCatalog('homesafety.priority')
  const status = useCatalog('homesafety.status')

  const [formOpen, setFormOpen] = useState(false)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [editing, setEditing] = useState<HomeSafetyItem | null>(null)
  const [historyItem, setHistoryItem] = useState<HomeSafetyItem | null>(null)
  const [toDelete, setToDelete] = useState<HomeSafetyItem | null>(null)

  const [q, setQ] = useState('')
  const categoryFilter = searchParams.get('category') ?? ''
  const statusFilter = searchParams.get('status') ?? ''

  const setParam = (key: string, value: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  const params = useMemo(
    () => ({
      category: categoryFilter || undefined,
      status: statusFilter || undefined,
      q: q.trim() || undefined,
    }),
    [categoryFilter, statusFilter, q],
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: homeSafetyKeys.items(params),
    queryFn: () => listHomeSafetyItems(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteHomeSafetyItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: homeSafetyKeys.all })
      setToDelete(null)
      show('Item excluído.')
    },
  })

  const items = data ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (i: HomeSafetyItem) => {
    setEditing(i)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Itens de segurança"
        subtitle="Gerencie os itens de segurança da casa, suas validades e manutenções."
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<LibraryAddRoundedIcon />} onClick={() => setCatalogOpen(true)}>
              Adicionar do catálogo
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo item
            </Button>
          </Stack>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, marca, modelo…"
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
          <AutocompleteField
            label="Categoria"
            size="small"
            emptyLabel="Todas"
            value={categoryFilter}
            onChange={(v) => setParam('category', v)}
            options={category.options}
            loading={category.isLoading}
            fullWidth={false}
            sx={{ minWidth: { sm: 180 } }}
          />
          <AutocompleteField
            label="Status"
            size="small"
            emptyLabel="Todos"
            value={statusFilter}
            onChange={(v) => setParam('status', v)}
            options={status.options}
            loading={status.isLoading}
            fullWidth={false}
            sx={{ minWidth: { sm: 160 } }}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<ShieldRoundedIcon />}
          title="Nenhum item encontrado"
          description={
            q || categoryFilter || statusFilter
              ? 'Ajuste a busca ou os filtros.'
              : 'Cadastre um item ou adicione a partir do catálogo sugerido.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo item
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Local</TableCell>
                  <TableCell>Periodicidade</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {i.name}
                        </Typography>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 0.25 }}>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={riskType.labelOf(i.risk_type)}
                            sx={{ fontSize: 10, height: 18 }}
                          />
                          <Chip
                            size="small"
                            color={PRIORITY_COLOR[i.priority]}
                            label={priority.labelOf(i.priority)}
                            sx={{ fontSize: 10, height: 18 }}
                          />
                        </Stack>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{category.labelOf(i.category)}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{i.location ?? '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {i.service_interval_months
                        ? formatMonths(i.service_interval_months)
                        : i.lifespan_months
                          ? `Validade ${formatMonths(i.lifespan_months)}`
                          : '—'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(i.next_due_date)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={status.labelOf(i.status)}
                        color={STATUS_COLOR[i.status]}
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Histórico / registrar manutenção">
                        <IconButton size="small" onClick={() => setHistoryItem(i)}>
                          <HistoryRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(i)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(i)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      )}

      {formOpen && <ItemFormDialog open={formOpen} item={editing} onClose={() => setFormOpen(false)} />}
      {catalogOpen && <CatalogDialog open={catalogOpen} onClose={() => setCatalogOpen(false)} />}
      {historyItem && <EventsDialog item={historyItem} onClose={() => setHistoryItem(null)} />}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir item"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? O histórico de eventos também será removido.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
