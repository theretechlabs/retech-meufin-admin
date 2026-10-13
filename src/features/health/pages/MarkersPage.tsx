import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import BiotechRoundedIcon from '@mui/icons-material/BiotechRounded'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  createMarker,
  deleteMarker,
  listMarkers,
  updateMarker,
  type Marker,
  type MarkerConflict,
  type MarkerInput,
} from '../api'
import { errorMessage, healthKeys, MARKER_CATEGORIES, MARKER_CATEGORY_LABEL } from '../constants'
import { PageHeader } from '../components/PageHeader'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '../components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

type FormValues = {
  canonical_name: string
  category: string
  comparability_class: string
  canonical_unit: string
  aliases: string
}

const emptyForm: FormValues = {
  canonical_name: '',
  category: '',
  comparability_class: '',
  canonical_unit: '',
  aliases: '',
}

function isConflict(err: unknown): MarkerConflict | null {
  const anyErr = err as { response?: { status?: number; data?: MarkerConflict } }
  if (anyErr?.response?.status === 409 && anyErr.response.data?.suggestion) {
    return anyErr.response.data
  }
  return null
}

function MarkerFormDialog({
  open,
  marker,
  onClose,
}: {
  open: boolean
  marker: Marker | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(marker)
  const [conflict, setConflict] = useState<MarkerConflict | null>(null)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: marker
      ? {
          canonical_name: marker.canonical_name,
          category: marker.category,
          comparability_class: marker.comparability_class,
          canonical_unit: marker.canonical_unit ?? '',
          aliases: (marker.aliases ?? []).join(', '),
        }
      : emptyForm,
  })

  const toInput = (values: FormValues): MarkerInput => ({
    canonical_name: values.canonical_name.trim(),
    category: values.category.trim(),
    comparability_class: values.comparability_class.trim(),
    canonical_unit: values.canonical_unit.trim() || null,
    aliases: values.aliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit ? updateMarker(marker!.id, toInput(values)) : createMarker(toInput(values)),
    onSuccess: () => {
      show(isEdit ? 'Marcador atualizado com sucesso.' : 'Marcador criado com sucesso.')
      qc.invalidateQueries({ queryKey: healthKeys.all })
      reset(emptyForm)
      onClose()
    },
    onError: (err) => {
      setConflict(isConflict(err))
    },
  })

  const submit = handleSubmit((values) => {
    setConflict(null)
    mutation.mutate(values)
  })

  const genericError = mutation.isError && !conflict ? errorMessage(mutation.error) : null

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar marcador' : 'Novo marcador do catálogo'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {conflict && (
            <Alert severity="warning">
              Já existe um marcador equivalente: <strong>{conflict.suggestion.canonical_name}</strong>
              {conflict.suggestion.canonical_unit ? ` (${conflict.suggestion.canonical_unit})` : ''}. Use
              o marcador existente em vez de duplicar.
            </Alert>
          )}
          {genericError && <ErrorState message={genericError} />}
          <Controller
            name="canonical_name"
            control={control}
            rules={{ required: 'Informe o nome canônico' }}
            render={({ field }) => (
              <TextField
                {...field}
                label="Nome canônico"
                fullWidth
                required
                error={Boolean(errors.canonical_name)}
                helperText={errors.canonical_name?.message}
              />
            )}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="category"
              control={control}
              rules={{ required: 'Informe a categoria' }}
              render={({ field }) => (
                <AutocompleteField
                  label="Categoria"
                  value={field.value}
                  onChange={field.onChange}
                  options={MARKER_CATEGORIES}
                  required
                  disableClearable
                  error={Boolean(errors.category)}
                  helperText={errors.category?.message}
                />
              )}
            />
            <Controller
              name="comparability_class"
              control={control}
              rules={{ required: 'Informe a classe de comparabilidade' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Classe de comparabilidade"
                  fullWidth
                  required
                  error={Boolean(errors.comparability_class)}
                  helperText={errors.comparability_class?.message}
                />
              )}
            />
          </Stack>
          <Controller
            name="canonical_unit"
            control={control}
            render={({ field }) => <TextField {...field} label="Unidade canônica" fullWidth />}
          />
          <Controller
            name="aliases"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                label="Sinônimos (separados por vírgula)"
                fullWidth
                placeholder="glicemia, glucose"
                helperText="Ex.: glicemia, glucose"
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


export default function MarkersPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Marker | null>(null)
  const [toDelete, setToDelete] = useState<Marker | null>(null)

  const params = useMemo(
    () => ({
      query: query || undefined,
      category: category || undefined,
      limit: pageSize,
      offset: page * pageSize,
    }),
    [query, category, page, pageSize]
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: healthKeys.markers(params),
    queryFn: () => listMarkers(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMarker(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: healthKeys.all })
      setToDelete(null)
      show('Marcador excluído.')
    },
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (m: Marker) => {
    setEditing(m)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Exames (catálogo)"
        subtitle="Marcadores canônicos usados nos resultados. Itens de sistema são somente leitura."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo marcador
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
            placeholder="Buscar por nome ou sinônimo…"
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
            fullWidth={false}
            sx={{ minWidth: { sm: 220 } }}
            emptyLabel="Todas"
            value={category}
            onChange={(v) => {
              setCategory(v)
              setPage(0)
            }}
            options={MARKER_CATEGORIES}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<BiotechRoundedIcon />}
          title="Nenhum marcador encontrado"
          description={
            query || category
              ? 'Ajuste os filtros ou crie um novo marcador do tenant.'
              : 'Crie o primeiro marcador do catálogo do seu tenant.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo marcador
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nome canônico</TableCell>
                  <TableCell>Categoria</TableCell>
                  <TableCell>Unidade</TableCell>
                  <TableCell>Comparabilidade</TableCell>
                  <TableCell>Origem</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell sx={{ fontWeight: 600 }}>
                      <Stack spacing={0.25}>
                        <span>{m.canonical_name}</span>
                        {m.aliases && m.aliases.length > 0 && (
                          <Typography variant="caption" color="text.secondary">
                            {m.aliases.map((a) => a.alias).join(', ')}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell>{MARKER_CATEGORY_LABEL[m.category] ?? m.category}</TableCell>
                    <TableCell>{m.canonical_unit || '—'}</TableCell>
                    <TableCell>{m.comparability_class}</TableCell>
                    <TableCell>
                      {m.scope === 'system' ? (
                        <Chip
                          size="small"
                          icon={<LockRoundedIcon sx={{ fontSize: 14 }} />}
                          label="Sistema"
                          variant="outlined"
                        />
                      ) : (
                        <Chip size="small" label="Tenant" color="primary" variant="outlined" />
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {m.scope === 'system' ? (
                        <Tooltip title="Marcador de sistema (somente leitura)">
                          <Box component="span">
                            <IconButton size="small" disabled>
                              <LockRoundedIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Tooltip>
                      ) : (
                        <>
                          <Tooltip title="Editar">
                            <IconButton size="small" onClick={() => openEdit(m)}>
                              <EditRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Excluir">
                            <IconButton size="small" color="error" onClick={() => setToDelete(m)}>
                              <DeleteOutlineRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePaginationBR
            total={total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </Card>
      )}

      {formOpen && (
        <MarkerFormDialog open={formOpen} marker={editing} onClose={() => setFormOpen(false)} />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir marcador"
        description={`Tem certeza que deseja excluir "${toDelete?.canonical_name}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
