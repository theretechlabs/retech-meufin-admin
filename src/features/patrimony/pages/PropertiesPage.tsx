import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import HomeWorkRoundedIcon from '@mui/icons-material/HomeWorkRounded'
import FolderRoundedIcon from '@mui/icons-material/FolderRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { MoneyField } from '@/components/fields/MoneyField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import {
  createProperty,
  deleteProperty,
  listProperties,
  updateProperty,
  type Property,
  type PropertyInput,
} from '../api'
import {
  errorMessage,
  formatArea,
  formatCents,
  patrimonyKeys,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPE_OPTIONS,
} from '../constants'
import { PropertyDocumentsDialog } from '../components/PropertyDocumentsDialog'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

type FormValues = {
  name: string
  property_type: string
  address: string
  city: string
  state: string
  zip_code: string
  registration_number: string
  area_m2: string
  purchase_date: string
  purchase_value_cents: string
  current_value_cents: string
  notes: string
}

const emptyForm: FormValues = {
  name: '',
  property_type: 'casa',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  registration_number: '',
  area_m2: '',
  purchase_date: '',
  purchase_value_cents: '',
  current_value_cents: '',
  notes: '',
}

function mapPropertyToForm(p: Property): FormValues {
  return {
    name: p.name,
    property_type: p.property_type,
    address: p.address ?? '',
    city: p.city ?? '',
    state: p.state ?? '',
    zip_code: p.zip_code ?? '',
    registration_number: p.registration_number ?? '',
    area_m2: p.area_m2 != null ? String(p.area_m2) : '',
    purchase_date: p.purchase_date ?? '',
    purchase_value_cents: p.purchase_value_cents != null ? String(p.purchase_value_cents) : '',
    current_value_cents: p.current_value_cents != null ? String(p.current_value_cents) : '',
    notes: p.notes ?? '',
  }
}

// Converte a máscara pt-BR do MoneyField ("1.234,56") em centavos inteiros.
function maskToCents(masked: string): number | null {
  const digits = String(masked).replace(/\D/g, '')
  return digits ? Number(digits) : null
}

function PropertyFormDialog({
  open,
  property,
  onClose,
}: {
  open: boolean
  property: Property | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(property)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    values: property ? mapPropertyToForm(property) : emptyForm,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: PropertyInput = {
        name: values.name.trim(),
        property_type: values.property_type,
        address: values.address.trim() || null,
        city: values.city.trim() || null,
        state: values.state.trim() || null,
        zip_code: values.zip_code.trim() || null,
        registration_number: values.registration_number.trim() || null,
        area_m2: values.area_m2 ? parseFloat(values.area_m2.replace(',', '.')) || null : null,
        purchase_date: values.purchase_date || null,
        purchase_value_cents: maskToCents(values.purchase_value_cents),
        current_value_cents: maskToCents(values.current_value_cents),
        notes: values.notes.trim() || null,
      }
      if (isEdit && property) return updateProperty(property.id, input)
      return createProperty(input)
    },
    onSuccess: () => {
      show(isEdit ? 'Imóvel atualizado com sucesso.' : 'Imóvel cadastrado com sucesso.')
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Editar imóvel' : 'Novo imóvel'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="name"
              control={control}
              rules={{ required: 'Informe o nome do imóvel' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Nome"
                  fullWidth
                  required
                  placeholder="Ex: Apartamento Centro"
                  error={Boolean(errors.name)}
                  helperText={errors.name?.message}
                />
              )}
            />
            <Controller
              name="property_type"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <AutocompleteField
                  label="Tipo"
                  fullWidth={false}
                  sx={{ minWidth: 180 }}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={PROPERTY_TYPE_OPTIONS}
                  disableClearable
                />
              )}
            />
          </Stack>

          <Divider />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            LOCALIZAÇÃO
          </Typography>

          <Controller
            name="address"
            control={control}
            render={({ field }) => <TextField {...field} label="Endereço" fullWidth />}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="city"
              control={control}
              render={({ field }) => <TextField {...field} label="Cidade" fullWidth />}
            />
            <Controller
              name="state"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="UF" sx={{ minWidth: 100 }} inputProps={{ maxLength: 2 }} />
              )}
            />
            <Controller
              name="zip_code"
              control={control}
              render={({ field }) => <TextField {...field} label="CEP" sx={{ minWidth: 140 }} />}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="registration_number"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Matrícula" fullWidth placeholder="Nº da matrícula no cartório" />
              )}
            />
            <Controller
              name="area_m2"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Área (m²)" sx={{ minWidth: 160 }} type="number" inputProps={{ min: 0, step: '0.01' }} />
              )}
            />
          </Stack>

          <Divider />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            VALORES
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="purchase_date"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Data de compra"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
            <Controller
              name="purchase_value_cents"
              control={control}
              render={({ field }) => <MoneyField {...field} label="Valor de compra" fullWidth />}
            />
            <Controller
              name="current_value_cents"
              control={control}
              render={({ field }) => <MoneyField {...field} label="Valor atual" fullWidth />}
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

export default function PropertiesPage() {
  const qc = useQueryClient()
  const { show } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Property | null>(null)
  const [toDelete, setToDelete] = useState<Property | null>(null)
  const [docsFor, setDocsFor] = useState<Property | null>(null)

  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({ limit: pageSize, offset: page * pageSize }),
    [pageSize, page],
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: patrimonyKeys.properties(params),
    queryFn: () => listProperties(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProperty(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      setToDelete(null)
      show('Imóvel excluído.')
    },
  })

  const properties = useMemo(() => {
    const items = data?.items ?? []
    if (!q.trim()) return items
    const lower = q.toLowerCase()
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.city ?? '').toLowerCase().includes(lower) ||
        (p.address ?? '').toLowerCase().includes(lower),
    )
  }, [data, q])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (p: Property) => {
    setEditing(p)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Imóveis"
        subtitle="Cadastre os imóveis da família e guarde seus documentos."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo imóvel
          </Button>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <TextField
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
          placeholder="Buscar por nome, cidade, endereço…"
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
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<HomeWorkRoundedIcon />}
          title="Nenhum imóvel encontrado"
          description={q ? 'Ajuste a busca.' : 'Cadastre o primeiro imóvel da família.'}
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo imóvel
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Imóvel</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Cidade</TableCell>
                  <TableCell>Área</TableCell>
                  <TableCell align="right">Valor atual</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {properties.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {p.name}
                        </Typography>
                        {p.address && (
                          <Typography variant="caption" color="text.secondary">
                            {p.address}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={PROPERTY_TYPE_LABEL[p.property_type]} variant="outlined" />
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {p.city ? `${p.city}${p.state ? `/${p.state}` : ''}` : '—'}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatArea(p.area_m2)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCents(p.current_value_cents ?? p.purchase_value_cents)}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Documentos">
                        <IconButton size="small" onClick={() => setDocsFor(p)}>
                          <FolderRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(p)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(p)}>
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
        <PropertyFormDialog open={formOpen} property={editing} onClose={() => setFormOpen(false)} />
      )}

      {docsFor && <PropertyDocumentsDialog property={docsFor} onClose={() => setDocsFor(null)} />}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir imóvel"
        description={`Tem certeza que deseja excluir "${toDelete?.name}"? Documentos e impostos vinculados também serão removidos. Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
