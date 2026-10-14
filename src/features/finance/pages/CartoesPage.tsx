import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
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
} from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  createCard,
  deleteCard,
  listCardsPaged,
  updateCard,
  type CreditCard,
  type CreditCardInput,
} from '../api'
import { errorMessage, financeKeys, ARCHIVED_FILTER_OPTIONS_M } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

type FormValues = {
  name: string
  bank: string
  brand: string
  closing_day: string
  due_day: string
  active: boolean
  notes: string
}

const emptyForm: FormValues = {
  name: '',
  bank: '',
  brand: '',
  closing_day: '',
  due_day: '',
  active: true,
  notes: '',
}

function toDayNumber(value: string): number | null {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 1 || n > 31) return null
  return Math.trunc(n)
}

function CardFormDialog({
  open,
  card,
  onClose,
}: {
  open: boolean
  card: CreditCard | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(card)
  const cardBank = useCatalog('finance.card_bank')
  const cardBrand = useCatalog('finance.card_brand')

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: card
      ? {
          name: card.name,
          bank: card.bank ?? '',
          brand: card.brand ?? '',
          closing_day: card.closing_day != null ? String(card.closing_day) : '',
          due_day: card.due_day != null ? String(card.due_day) : '',
          active: card.active,
          notes: card.notes ?? '',
        }
      : emptyForm,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: CreditCardInput = {
        name: values.name.trim(),
        bank: values.bank || null,
        brand: values.brand || null,
        closing_day: toDayNumber(values.closing_day),
        due_day: toDayNumber(values.due_day),
        active: values.active,
        notes: values.notes.trim() || null,
      }
      return isEdit ? updateCard(card!.id, input) : createCard(input)
    },
    onSuccess: () => {
      show(isEdit ? 'Cartão atualizado com sucesso.' : 'Cartão criado com sucesso.')
      qc.invalidateQueries({ queryKey: financeKeys.cards() })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  const dayRules = {
    validate: (v: string) =>
      v === '' || (Number(v) >= 1 && Number(v) <= 31) || 'Informe um dia entre 1 e 31',
  }

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar cartão' : 'Novo cartão'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome do cartão' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome"
                fullWidth
                required
                error={Boolean(errors.name)}
                helperText={errors.name?.message}
              />
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="bank"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Banco"
                  value={field.value}
                  onChange={field.onChange}
                  options={cardBank.options}
                  loading={cardBank.isLoading}
                  placeholder="Busque pelo nome (ex.: Carrefour)"
                />
              )}
            />
            <Controller
              name="brand"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Bandeira"
                  emptyLabel="Não informada"
                  value={field.value}
                  onChange={field.onChange}
                  options={cardBrand.options}
                  loading={cardBrand.isLoading}
                />
              )}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="closing_day"
              control={control}
              rules={dayRules}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Dia de fechamento"
                  fullWidth
                  inputProps={{ min: 1, max: 31 }}
                  error={Boolean(errors.closing_day)}
                  helperText={errors.closing_day?.message}
                />
              )}
            />
            <Controller
              name="due_day"
              control={control}
              rules={dayRules}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Dia de vencimento"
                  fullWidth
                  inputProps={{ min: 1, max: 31 }}
                  error={Boolean(errors.due_day)}
                  helperText={errors.due_day?.message}
                />
              )}
            />
          </Stack>
          <Controller
            name="notes"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Observações" fullWidth multiline minRows={2} />
            )}
          />
          <Controller
            name="active"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={(e) => field.onChange(e.target.checked)}
                  />
                }
                label="Ativo"
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
          {isEdit ? 'Salvar' : 'Criar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function CartoesPage() {
  const qc = useQueryClient()
  const { show } = useToast()

  const cardBank = useCatalog('finance.card_bank')
  const cardBrand = useCatalog('finance.card_brand')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CreditCard | null>(null)
  const [toDelete, setToDelete] = useState<CreditCard | null>(null)

  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      query: q.trim() || undefined,
      active: status === '' ? undefined : status === 'true',
    }),
    [pageSize, page, q, status]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...financeKeys.cards(), params],
    queryFn: () => listCardsPaged(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCard(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.cards() })
      setToDelete(null)
      show('Cartão excluído.')
    },
  })

  const cards = useMemo(() => data?.items ?? [], [data])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (c: CreditCard) => {
    setEditing(c)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Cartões de Crédito"
        subtitle="Cadastre seus cartões e vincule faturas e compras parceladas."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo cartão
          </Button>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
            placeholder="Buscar por nome…"
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
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 200 } }}
            emptyLabel="Todos"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={ARCHIVED_FILTER_OPTIONS_M}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={<CreditCardRoundedIcon />}
          title="Nenhum cartão cadastrado"
          description={
            q || status
              ? 'Ajuste a busca ou os filtros.'
              : 'Adicione o primeiro cartão para começar a controlar faturas.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo cartão
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome</TableCell>
                  <TableCell>Banco</TableCell>
                  <TableCell>Bandeira</TableCell>
                  <TableCell align="center">Fechamento</TableCell>
                  <TableCell align="center">Vencimento</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cards.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{c.name}</TableCell>
                    <TableCell>{cardBank.labelOf(c.bank)}</TableCell>
                    <TableCell>{cardBrand.labelOf(c.brand)}</TableCell>
                    <TableCell align="center">
                      {c.closing_day != null ? `Dia ${c.closing_day}` : '—'}
                    </TableCell>
                    <TableCell align="center">
                      {c.due_day != null ? `Dia ${c.due_day}` : '—'}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={c.active ? 'Ativo' : 'Inativo'}
                        color={c.active ? 'success' : 'default'}
                        variant={c.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(c)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(c)}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
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
        <CardFormDialog open={formOpen} card={editing} onClose={() => setFormOpen(false)} />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir cartão"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
