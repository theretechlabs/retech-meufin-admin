import { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import ShoppingCartCheckoutRoundedIcon from '@mui/icons-material/ShoppingCartCheckoutRounded'
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addSupplyItem,
  createSupplyList,
  deleteSupplyItem,
  deleteSupplyList,
  listEnrollments,
  listSupplyLists,
  purchaseSupplyItem,
  updateSupplyItem,
  updateSupplyList,
  type ItemCategory,
  type ListStatus,
  type SupplyItem,
  type SupplyList,
} from '../api'
import {
  centsToReais,
  CURRENT_YEAR,
  educationKeys,
  errorMessage,
  formatCents,
  ITEM_CATEGORY_LABEL,
  ITEM_CATEGORY_OPTIONS,
  LIST_STATUS_COLOR,
  LIST_STATUS_LABEL,
  LIST_STATUS_OPTIONS,
  STAGE_LABEL,
  toCents,
} from '../constants'
import { PageHeader } from '@/features/health/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { numericOptions } from '@/components/fields/options'
import { useSchoolYears } from '../hooks/useSchoolYears'

/** Diferença referência × pago de um item comprado, em centavos (positivo = economia). */
function itemSavingsCents(item: SupplyItem): number | null {
  if (!item.purchased) return null
  return Math.round(item.reference_price_cents * item.quantity) - item.paid_price_cents
}

function DiffChip({ cents }: { cents: number | null }) {
  if (cents == null) return <Typography variant="caption" color="text.disabled">—</Typography>
  if (cents === 0) return <Chip size="small" label="No preço" variant="outlined" />
  const economia = cents > 0
  return (
    <Chip
      size="small"
      color={economia ? 'success' : 'error'}
      variant="outlined"
      label={`${economia ? '↓' : '↑'} ${formatCents(Math.abs(cents))}`}
    />
  )
}

// ─── Add-item inline form ─────────────────────────────────────────────────────

function AddItemRow({ listId }: { listId: string }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<ItemCategory>('papelaria')
  const [quantity, setQuantity] = useState('1')
  const [refReais, setRefReais] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      addSupplyItem(listId, {
        name,
        category,
        quantity: Number(quantity) || 1,
        reference_price_cents: toCents(refReais || '0'),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.all })
      setName('')
      setRefReais('')
      setQuantity('1')
    },
  })

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center" sx={{ p: 1.5 }}>
      <TextField
        size="small"
        label="Item"
        value={name}
        onChange={(e) => setName(e.target.value)}
        sx={{ flex: 1, minWidth: 160 }}
      />
      <AutocompleteField
        label="Categoria"
        size="small"
        value={category}
        onChange={(v) => setCategory(v as ItemCategory)}
        options={ITEM_CATEGORY_OPTIONS}
        disableClearable
        fullWidth={false}
        sx={{ minWidth: 130 }}
      />
      <TextField
        size="small"
        type="number"
        label="Qtd"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        sx={{ width: 80 }}
      />
      <TextField
        size="small"
        type="number"
        label="Ref. (R$)"
        value={refReais}
        onChange={(e) => setRefReais(e.target.value)}
        sx={{ width: 120 }}
      />
      <Button
        variant="outlined"
        startIcon={<AddRoundedIcon />}
        onClick={() => name && mutation.mutate()}
        disabled={!name || mutation.isPending}
      >
        Adicionar
      </Button>
    </Stack>
  )
}

// ─── Purchase dialog ──────────────────────────────────────────────────────────

function PurchaseDialog({
  listId,
  item,
  onClose,
}: {
  listId: string
  item: SupplyItem
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [paidReais, setPaidReais] = useState(
    item.paid_price_cents > 0 ? String(centsToReais(item.paid_price_cents)) : '',
  )
  const [purchasedAt, setPurchasedAt] = useState(
    item.purchased_at ?? new Date().toISOString().slice(0, 10),
  )
  const [store, setStore] = useState(item.store ?? '')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      purchaseSupplyItem(listId, item.id, {
        paid_price_cents: toCents(paidReais || '0'),
        purchased_at: purchasedAt || null,
        store: store || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.all })
      onClose()
    },
    onError: (err) => setError(errorMessage(err)),
  })

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Marcar como comprado</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {item.name} · referência {formatCents(Math.round(item.reference_price_cents * item.quantity))}
          </Typography>
          <TextField
            autoFocus
            type="number"
            label="Valor pago (R$)"
            value={paidReais}
            onChange={(e) => setPaidReais(e.target.value)}
          />
          <TextField
            type="date"
            label="Data da compra"
            InputLabelProps={{ shrink: true }}
            value={purchasedAt}
            onChange={(e) => setPurchasedAt(e.target.value)}
          />
          <TextField label="Loja" value={store} onChange={(e) => setStore(e.target.value)} />
          {error && (
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Confirmar compra
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ─── List card ────────────────────────────────────────────────────────────────

function SupplyListCard({
  list,
  onPurchase,
}: {
  list: SupplyList
  onPurchase: (listId: string, item: SupplyItem) => void
}) {
  const queryClient = useQueryClient()

  const togglePurchased = useMutation({
    mutationFn: (item: SupplyItem) =>
      updateSupplyItem(list.id, item.id, {
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        reference_price_cents: item.reference_price_cents,
        purchased: !item.purchased,
        paid_price_cents: item.paid_price_cents,
        purchased_at: item.purchased_at ?? null,
        store: item.store ?? null,
        notes: item.notes ?? null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: educationKeys.all }),
  })

  const removeItem = useMutation({
    mutationFn: (itemId: string) => deleteSupplyItem(list.id, itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: educationKeys.all }),
  })

  const changeStatus = useMutation({
    mutationFn: (status: ListStatus) =>
      updateSupplyList(list.id, { title: list.title, status, notes: list.notes ?? null }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: educationKeys.all }),
  })

  const removeList = useMutation({
    mutationFn: () => deleteSupplyList(list.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: educationKeys.all }),
  })

  const totals = useMemo(() => {
    let ref = 0
    let paid = 0
    let purchased = 0
    list.items.forEach((it) => {
      ref += Math.round(it.reference_price_cents * it.quantity)
      if (it.purchased) {
        paid += it.paid_price_cents
        purchased += 1
      }
    })
    return { ref, paid, purchased, count: list.items.length }
  }, [list.items])

  return (
    <Accordion defaultExpanded={false} disableGutters>
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ xs: 'flex-start', sm: 'center' }}
          justifyContent="space-between"
          sx={{ width: '100%', pr: 2 }}
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              {list.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {list.member_name ?? '—'}
              {list.school_year ? ` · ${list.school_year}` : ''}
              {` · ${totals.purchased}/${totals.count} comprados`}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              label={LIST_STATUS_LABEL[list.status]}
              color={LIST_STATUS_COLOR[list.status]}
            />
            <Typography variant="body2" color="text.secondary">
              Pago {formatCents(totals.paid)} / Ref {formatCents(totals.ref)}
            </Typography>
          </Stack>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          justifyContent="flex-end"
          sx={{ px: 2, py: 1 }}
        >
          <AutocompleteField
            label="Status"
            size="small"
            value={list.status}
            onChange={(v) => changeStatus.mutate(v as ListStatus)}
            options={LIST_STATUS_OPTIONS}
            disableClearable
            fullWidth={false}
            sx={{ minWidth: 150 }}
          />
          <Tooltip title="Excluir lista">
            <IconButton
              color="error"
              onClick={() => {
                if (window.confirm(`Excluir a lista "${list.title}"?`)) removeList.mutate()
              }}
            >
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" />
              <TableCell>Item</TableCell>
              <TableCell>Categoria</TableCell>
              <TableCell align="right">Qtd</TableCell>
              <TableCell align="right">Referência</TableCell>
              <TableCell align="right">Pago</TableCell>
              <TableCell align="right">Economia</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    Nenhum item ainda. Adicione abaixo.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((it) => (
                <TableRow key={it.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={it.purchased}
                      onChange={() => togglePurchased.mutate(it)}
                    />
                  </TableCell>
                  <TableCell
                    sx={{
                      textDecoration: it.purchased ? 'line-through' : 'none',
                      color: it.purchased ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {it.name}
                    {it.store ? (
                      <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                        {it.store}
                      </Typography>
                    ) : null}
                  </TableCell>
                  <TableCell>{ITEM_CATEGORY_LABEL[it.category] ?? it.category}</TableCell>
                  <TableCell align="right">{it.quantity}</TableCell>
                  <TableCell align="right">
                    {formatCents(Math.round(it.reference_price_cents * it.quantity))}
                  </TableCell>
                  <TableCell align="right">{it.purchased ? formatCents(it.paid_price_cents) : '—'}</TableCell>
                  <TableCell align="right">
                    <DiffChip cents={itemSavingsCents(it)} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Marcar comprado / editar compra">
                      <IconButton size="small" color="primary" onClick={() => onPurchase(list.id, it)}>
                        <ShoppingCartCheckoutRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remover item">
                      <IconButton size="small" color="error" onClick={() => removeItem.mutate(it.id)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <AddItemRow listId={list.id} />
      </AccordionDetails>
    </Accordion>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SupplyListsPage() {
  const queryClient = useQueryClient()
  const [yearFilter, setYearFilter] = useState<number | ''>(CURRENT_YEAR)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [createOpen, setCreateOpen] = useState(false)
  const [purchaseTarget, setPurchaseTarget] = useState<{ listId: string; item: SupplyItem } | null>(null)

  const [newEnrollmentId, setNewEnrollmentId] = useState('')
  const [newTitle, setNewTitle] = useState(`Lista de material ${CURRENT_YEAR}`)
  const [createError, setCreateError] = useState<string | null>(null)

  const enrollmentsQuery = useQuery({
    queryKey: educationKeys.enrollments({}),
    queryFn: () => listEnrollments(),
  })
  const enrollments = enrollmentsQuery.data ?? []

  const params = useMemo(() => {
    const p: { school_year?: number; status?: string } = {}
    if (yearFilter) p.school_year = yearFilter
    if (statusFilter) p.status = statusFilter
    return p
  }, [yearFilter, statusFilter])

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: educationKeys.lists(params),
    queryFn: () => listSupplyLists(params),
  })
  const lists = data ?? []
  const years = useSchoolYears()

  const createMutation = useMutation({
    mutationFn: () =>
      createSupplyList({ enrollment_id: newEnrollmentId, title: newTitle, status: 'planejada' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: educationKeys.all })
      setCreateOpen(false)
    },
    onError: (err) => setCreateError(errorMessage(err)),
  })

  function openCreate() {
    setNewEnrollmentId(enrollments[0]?.id ?? '')
    setNewTitle(`Lista de material ${yearFilter || CURRENT_YEAR}`)
    setCreateError(null)
    setCreateOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Listas de material"
        subtitle="Itens por lista, preço de referência × pago e progresso das compras."
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={openCreate}
            disabled={enrollments.length === 0}
          >
            Nova lista
          </Button>
        }
      />

      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <AutocompleteField
          label="Ano letivo"
          size="small"
          emptyLabel="Todos os anos"
          value={yearFilter === '' ? '' : String(yearFilter)}
          onChange={(v) => setYearFilter(v === '' ? '' : Number(v))}
          options={numericOptions(years)}
          fullWidth={false}
          sx={{ minWidth: 150 }}
        />
        <AutocompleteField
          label="Status"
          size="small"
          emptyLabel="Todos"
          value={statusFilter}
          onChange={setStatusFilter}
          options={LIST_STATUS_OPTIONS}
          fullWidth={false}
          sx={{ minWidth: 150 }}
        />
      </Stack>

      {enrollments.length === 0 && !enrollmentsQuery.isLoading && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Cadastre uma matrícula antes de criar listas de material.
          </Typography>
        </Box>
      )}

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : lists.length === 0 ? (
        <EmptyState
          icon={<ListAltRoundedIcon />}
          title="Nenhuma lista encontrada"
          description="Crie a lista de material de uma matrícula para começar."
          action={
            enrollments.length > 0 ? (
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
                Nova lista
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stack spacing={1.5}>
          {lists.map((l) => (
            <SupplyListCard
              key={l.id}
              list={l}
              onPurchase={(listId, item) => setPurchaseTarget({ listId, item })}
            />
          ))}
        </Stack>
      )}

      {purchaseTarget && (
        <PurchaseDialog
          key={purchaseTarget.item.id}
          listId={purchaseTarget.listId}
          item={purchaseTarget.item}
          onClose={() => setPurchaseTarget(null)}
        />
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Nova lista de material</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid size={{ xs: 12 }}>
              <AutocompleteField
                label="Matrícula"
                value={newEnrollmentId}
                onChange={setNewEnrollmentId}
                options={enrollments.map((en) => ({
                  value: en.id,
                  label: `${en.member_name ?? 'Membro'} · ${en.school_year} · ${STAGE_LABEL[en.stage] ?? en.stage}`,
                }))}
                disableClearable
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label="Título"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </Grid>
            {createError && (
              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" color="error">
                  {createError}
                </Typography>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => newEnrollmentId && createMutation.mutate()}
            disabled={!newEnrollmentId || createMutation.isPending}
          >
            Criar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
