import { useMemo, useState } from 'react'
import {
  Alert,
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
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  createExpenseCategory,
  deleteExpenseCategory,
  listExpenseCategories,
  updateExpenseCategory,
  type ExpenseCategory,
  type ExpenseGroup,
} from '../api'
import { errorMessage, financeKeys, ARCHIVED_FILTER_OPTIONS_F } from '../constants'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

type FormValues = {
  name: string
  group_slug: string
  active: boolean
}

function CategoryFormDialog({
  category,
  groups,
  onClose,
}: {
  category: ExpenseCategory | null
  groups: ExpenseGroup[]
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(category)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    values: category
      ? { name: category.name, group_slug: category.group_slug, active: category.active }
      : { name: '', group_slug: 'outros', active: true },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? updateExpenseCategory(category!.id, values)
        : createExpenseCategory({ name: values.name, group_slug: values.group_slug }),
    onSuccess: () => {
      show(isEdit ? 'Categoria atualizada com sucesso.' : 'Categoria criada com sucesso.')
      qc.invalidateQueries({ queryKey: financeKeys.expenseCategories() })
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar categoria' : 'Nova categoria'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Informe o nome' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome"
                placeholder="Ex.: Pets, Escola do João, Viagens"
                fullWidth
                required
                error={Boolean(errors.name)}
                helperText={errors.name?.message}
              />
            )}
          />
          <Controller
            name="group_slug"
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <AutocompleteField
                label="Grupo"
                required
                value={field.value}
                onChange={field.onChange}
                options={groups.map((g) => ({
                  value: g.slug,
                  label: g.name,
                  description: g.description,
                }))}
                placeholder="Busque por nome ou exemplo (ex.: cinema)"
                helperText="O grupo é fixo do sistema — é por ele que os indicadores agregam."
              />
            )}
          />
          {isEdit && (
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
                  label="Ativa (aparece nos formulários)"
                />
              )}
            />
          )}
          {isEdit && (
            <Alert severity="info">
              Renomear muda só o rótulo — o histórico de lançamentos continua ligado a esta
              categoria.
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

export default function CategoriasPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ExpenseCategory | null>(null)
  const [toDelete, setToDelete] = useState<ExpenseCategory | null>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      query: query.trim() || undefined,
      group: group || undefined,
      active: status === '' ? undefined : status === 'true',
    }),
    [query, group, status, page, pageSize]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [...financeKeys.expenseCategories(), params],
    queryFn: () => listExpenseCategories(params),
  })

  const hasFilters = Boolean(query.trim() || group || status)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteExpenseCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.expenseCategories() })
      setToDelete(null)
      show('Categoria excluída.')
    },
  })

  const categories = useMemo(() => data?.items ?? [], [data])
  const groups = useMemo(
    () => [...(data?.groups ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data]
  )

  return (
    <>
      <PageHeader
        title="Categorias de Despesa"
        subtitle="Crie e organize as categorias da família. Cada uma pertence a um grupo fixo do sistema — é o grupo que mantém os indicadores estáveis."
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
          >
            Nova categoria
          </Button>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
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
            label="Grupo"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 220 } }}
            emptyLabel="Todos"
            value={group}
            onChange={(v) => {
              setGroup(v)
              setPage(0)
            }}
            options={groups.map((g) => ({ value: g.slug, label: g.name }))}
          />
          <AutocompleteField
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 160 } }}
            emptyLabel="Todas"
            value={status}
            onChange={(v) => {
              setStatus(v)
              setPage(0)
            }}
            options={ARCHIVED_FILTER_OPTIONS_F}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={<CategoryRoundedIcon />}
          title="Nenhuma categoria encontrada"
          description={
            hasFilters
              ? 'Ajuste a busca ou os filtros.'
              : 'As categorias padrão são criadas automaticamente no primeiro uso.'
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Grupo (indicadores)</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>{cat.name}</TableCell>
                    <TableCell>
                      <Chip size="small" variant="outlined" label={cat.group_name} />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={cat.active ? 'Ativa' : 'Arquivada'}
                        color={cat.active ? 'success' : 'default'}
                        variant={cat.active ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEditing(cat)
                            setFormOpen(true)
                          }}
                        >
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={cat.slug === 'outros' ? "'Outros' é o destino padrão — não pode ser removida" : 'Excluir'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={cat.slug === 'outros'}
                            onClick={() => setToDelete(cat)}
                          >
                            <DeleteOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </span>
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
        <CategoryFormDialog
          category={editing}
          groups={groups}
          onClose={() => setFormOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir categoria"
        description={`Excluir "${toDelete?.name}"? Lançamentos antigos continuam mostrando o nome; ela some dos formulários.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
