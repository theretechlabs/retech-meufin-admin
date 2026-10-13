import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
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
import { MoneyField } from '@/components/fields/MoneyField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import {
  createVehicle,
  deleteVehicle,
  getFipePrice,
  listFipeBrands,
  listFipeModels,
  listFipeYears,
  listVehiclesPaged,
  updateVehicle,
  type Vehicle,
  type VehicleInput,
  type VehicleUpdateInput,
} from '../api'
import {
  errorMessage,
  FIPE_VEHICLE_TYPE_OPTIONS,
  FUEL_TYPE_OPTIONS,
  vehicleKeys,
  VEHICLE_STATUS_COLOR,
  VEHICLE_STATUS_LABEL,
  VEHICLE_STATUS_OPTIONS,
  FUEL_TYPE_LABEL,
  formatKM,
} from '../constants'
import { TablePaginationBR } from '@/components/tables/TablePaginationBR'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

// ─── Form ─────────────────────────────────────────────────────────────────────

type FormValues = {
  nickname: string
  make: string
  model: string
  year_manufacture: string
  year_model: string
  color: string
  plate: string
  fuel_type: string
  fipe_vehicle_type: string
  fipe_brand_code: string
  fipe_model_code: string
  fipe_year_code: string
  fipe_code: string
  acquisition_date: string
  acquisition_price: string
  current_odometer: string
  notes: string
  status: string
  sold_at: string
  sold_price: string
  active: boolean
}

const emptyForm: FormValues = {
  nickname: '',
  make: '',
  model: '',
  year_manufacture: '',
  year_model: '',
  color: '',
  plate: '',
  fuel_type: 'flex',
  fipe_vehicle_type: 'carros',
  fipe_brand_code: '',
  fipe_model_code: '',
  fipe_year_code: '',
  fipe_code: '',
  acquisition_date: '',
  acquisition_price: '',
  current_odometer: '0',
  notes: '',
  status: 'active',
  sold_at: '',
  sold_price: '',
  active: true,
}

function mapVehicleToForm(v: Vehicle): FormValues {
  return {
    nickname: v.nickname ?? '',
    make: v.make,
    model: v.model,
    year_manufacture: String(v.year_manufacture),
    year_model: String(v.year_model),
    color: v.color ?? '',
    plate: v.plate ?? '',
    fuel_type: v.fuel_type,
    fipe_vehicle_type: v.fipe_vehicle_type || 'carros',
    fipe_brand_code: v.fipe_brand_code ?? '',
    fipe_model_code: v.fipe_model_code ?? '',
    fipe_year_code: v.fipe_year_code ?? '',
    fipe_code: v.fipe_code ?? '',
    acquisition_date: v.acquisition_date ?? '',
    acquisition_price: v.acquisition_price != null ? String(Math.round(v.acquisition_price * 100)) : '',
    current_odometer: String(v.current_odometer),
    notes: v.notes ?? '',
    status: v.status,
    sold_at: v.sold_at ?? '',
    sold_price: v.sold_price != null ? String(Math.round(v.sold_price * 100)) : '',
    active: v.status === 'active',
  }
}

function VehicleFormDialog({
  open,
  vehicle,
  onClose,
}: {
  open: boolean
  vehicle: Vehicle | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(vehicle)

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    values: vehicle ? mapVehicleToForm(vehicle) : emptyForm,
  })

  const fipeVehicleType = useWatch({ control, name: 'fipe_vehicle_type' })
  const fipeBrandCode = useWatch({ control, name: 'fipe_brand_code' })
  const fipeModelCode = useWatch({ control, name: 'fipe_model_code' })
  const fipeYearCode = useWatch({ control, name: 'fipe_year_code' })
  const status = useWatch({ control, name: 'status' })

  const brandsQuery = useQuery({
    queryKey: vehicleKeys.fipeBrands(fipeVehicleType),
    queryFn: () => listFipeBrands(fipeVehicleType),
    enabled: Boolean(fipeVehicleType),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const modelsQuery = useQuery({
    queryKey: vehicleKeys.fipeModels(fipeVehicleType, fipeBrandCode),
    queryFn: () => listFipeModels(fipeVehicleType, fipeBrandCode),
    enabled: Boolean(fipeVehicleType && fipeBrandCode),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const yearsQuery = useQuery({
    queryKey: vehicleKeys.fipeYears(fipeVehicleType, fipeBrandCode, fipeModelCode),
    queryFn: () => listFipeYears(fipeVehicleType, fipeBrandCode, fipeModelCode),
    enabled: Boolean(fipeVehicleType && fipeBrandCode && fipeModelCode),
    staleTime: 24 * 60 * 60 * 1000,
  })

  const priceQuery = useQuery({
    queryKey: vehicleKeys.fipePrice(fipeVehicleType, fipeBrandCode, fipeModelCode, fipeYearCode),
    queryFn: () => getFipePrice(fipeVehicleType, fipeBrandCode, fipeModelCode, fipeYearCode),
    enabled: Boolean(fipeVehicleType && fipeBrandCode && fipeModelCode && fipeYearCode),
    staleTime: 2 * 60 * 60 * 1000,
  })

  useEffect(() => {
    if (priceQuery.data) {
      setValue('make', priceQuery.data.Marca)
      setValue('model', priceQuery.data.Modelo)
      setValue('year_model', String(priceQuery.data.AnoModelo))
      setValue('fipe_code', priceQuery.data.CodigoFipe)
    }
  }, [priceQuery.data, setValue])

  const mutation = useMutation({
    mutationFn: useCallback(
      (values: FormValues) => {
        const base: VehicleInput = {
          nickname: values.nickname.trim() || null,
          make: values.make.trim(),
          model: values.model.trim(),
          year_manufacture: parseInt(values.year_manufacture) || 0,
          year_model: parseInt(values.year_model) || 0,
          color: values.color.trim() || null,
          plate: values.plate.trim() || null,
          fuel_type: values.fuel_type,
          fipe_vehicle_type: values.fipe_vehicle_type || undefined,
          fipe_brand_code: values.fipe_brand_code || null,
          fipe_model_code: values.fipe_model_code || null,
          fipe_year_code: values.fipe_year_code || null,
          fipe_code: values.fipe_code || null,
          acquisition_date: values.acquisition_date || null,
          acquisition_price: values.acquisition_price
            ? parseFloat(values.acquisition_price.replace(/\./g, '').replace(',', '.'))
            : null,
          current_odometer: parseInt(values.current_odometer) || 0,
          notes: values.notes.trim() || null,
        }
        if (isEdit && vehicle) {
          const upd: VehicleUpdateInput = {
            ...base,
            status: values.status,
            sold_at: values.status === 'sold' ? values.sold_at || null : null,
            sold_price:
              values.status === 'sold' && values.sold_price
                ? parseFloat(values.sold_price.replace(/\./g, '').replace(',', '.'))
                : null,
          }
          return updateVehicle(vehicle.id, upd)
        }
        return createVehicle(base)
      },
      [isEdit, vehicle],
    ),
    onSuccess: () => {
      show(isEdit ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.')
      qc.invalidateQueries({ queryKey: vehicleKeys.all })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  const brandOptions = (brandsQuery.data ?? []).map((b) => ({ value: b.codigo, label: b.nome }))
  const modelOptions = (modelsQuery.data ?? []).map((m) => ({ value: String(m.codigo), label: m.nome }))
  const yearOptions = (yearsQuery.data ?? []).map((y) => ({ value: y.codigo, label: y.nome }))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isEdit ? 'Editar veículo' : 'Novo veículo'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          {/* FIPE */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
              CONSULTA FIPE (OPCIONAL)
            </Typography>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Controller
                  name="fipe_vehicle_type"
                  control={control}
                  render={({ field }) => (
                    <AutocompleteField
                      label="Tipo de veículo"
                      size="small"
                      fullWidth={false}
                      sx={{ minWidth: 140 }}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v)
                        setValue('fipe_brand_code', '')
                        setValue('fipe_model_code', '')
                        setValue('fipe_year_code', '')
                        setValue('fipe_code', '')
                      }}
                      options={FIPE_VEHICLE_TYPE_OPTIONS}
                      disableClearable
                    />
                  )}
                />

                <Controller
                  name="fipe_brand_code"
                  control={control}
                  render={({ field }) => (
                    <AutocompleteField
                      label="Marca"
                      size="small"
                      sx={{ flex: 1 }}
                      options={brandOptions}
                      loading={brandsQuery.isLoading}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v)
                        setValue('fipe_model_code', '')
                        setValue('fipe_year_code', '')
                        setValue('fipe_code', '')
                      }}
                      disabled={!fipeVehicleType}
                    />
                  )}
                />

                <Controller
                  name="fipe_model_code"
                  control={control}
                  render={({ field }) => (
                    <AutocompleteField
                      label="Modelo"
                      size="small"
                      sx={{ flex: 1 }}
                      options={modelOptions}
                      loading={modelsQuery.isLoading}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v)
                        setValue('fipe_year_code', '')
                        setValue('fipe_code', '')
                      }}
                      disabled={!fipeBrandCode}
                    />
                  )}
                />

                <Controller
                  name="fipe_year_code"
                  control={control}
                  render={({ field }) => (
                    <AutocompleteField
                      label="Ano / Combustível"
                      size="small"
                      fullWidth={false}
                      sx={{ minWidth: 160 }}
                      options={yearOptions}
                      loading={yearsQuery.isLoading}
                      value={field.value}
                      onChange={field.onChange}
                      disabled={!fipeModelCode}
                    />
                  )}
                />
              </Stack>

              {priceQuery.data && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    bgcolor: 'success.main',
                    color: 'success.contrastText',
                  }}
                >
                  <Typography variant="body2" fontWeight={700}>
                    FIPE {priceQuery.data.MesReferencia}:{' '}
                    {priceQuery.data.Valor}
                  </Typography>
                  <Typography variant="caption">
                    Código: {priceQuery.data.CodigoFipe} · {priceQuery.data.Combustivel}
                  </Typography>
                </Box>
              )}
              {priceQuery.isLoading && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary">
                    Consultando tabela FIPE…
                  </Typography>
                </Stack>
              )}
            </Stack>
          </Box>

          <Divider />

          {/* Dados do veículo */}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            DADOS DO VEÍCULO
          </Typography>

          <Controller
            name="nickname"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="Apelido" fullWidth placeholder="Ex: Carro da família" />
            )}
          />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="make"
              control={control}
              rules={{ required: 'Informe a marca' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Marca"
                  fullWidth
                  required
                  error={Boolean(errors.make)}
                  helperText={errors.make?.message}
                />
              )}
            />
            <Controller
              name="model"
              control={control}
              rules={{ required: 'Informe o modelo' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Modelo"
                  fullWidth
                  required
                  error={Boolean(errors.model)}
                  helperText={errors.model?.message}
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="year_manufacture"
              control={control}
              rules={{ required: 'Informe o ano de fabricação' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Ano de fabricação"
                  fullWidth
                  required
                  type="number"
                  inputProps={{ min: 1900, max: new Date().getFullYear() + 1 }}
                  error={Boolean(errors.year_manufacture)}
                  helperText={errors.year_manufacture?.message}
                />
              )}
            />
            <Controller
              name="year_model"
              control={control}
              rules={{ required: 'Informe o ano do modelo' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Ano do modelo"
                  fullWidth
                  required
                  type="number"
                  inputProps={{ min: 1900, max: new Date().getFullYear() + 2 }}
                  error={Boolean(errors.year_model)}
                  helperText={errors.year_model?.message}
                />
              )}
            />
            <Controller
              name="fuel_type"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <AutocompleteField
                  label="Combustível"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={FUEL_TYPE_OPTIONS}
                  disableClearable
                />
              )}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="plate"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Placa"
                  sx={{ minWidth: 160 }}
                  inputProps={{ style: { textTransform: 'uppercase' } }}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              )}
            />
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Cor" fullWidth />
              )}
            />
          </Stack>

          <Divider />

          {/* Aquisição */}
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            AQUISIÇÃO
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="acquisition_date"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Data de aquisição"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
            <Controller
              name="acquisition_price"
              control={control}
              render={({ field }) => (
                <MoneyField {...field} label="Valor de aquisição" fullWidth />
              )}
            />
            <Controller
              name="current_odometer"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Odômetro atual (km)"
                  fullWidth
                  type="number"
                  inputProps={{ min: 0 }}
                />
              )}
            />
          </Stack>

          {/* Status (edit only) */}
          {isEdit && (
            <>
              <Divider />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                STATUS
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Controller
                  name="status"
                  control={control}
                  render={({ field }) => (
                    <AutocompleteField
                      label="Status"
                      fullWidth={false}
                      sx={{ minWidth: 160 }}
                      value={field.value}
                      onChange={field.onChange}
                      options={VEHICLE_STATUS_OPTIONS}
                      disableClearable
                    />
                  )}
                />
                {status === 'sold' && (
                  <>
                    <Controller
                      name="sold_at"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          label="Data de venda"
                          type="date"
                          fullWidth
                          InputLabelProps={{ shrink: true }}
                        />
                      )}
                    />
                    <Controller
                      name="sold_price"
                      control={control}
                      render={({ field }) => (
                        <MoneyField {...field} label="Valor de venda" fullWidth />
                      )}
                    />
                  </>
                )}
              </Stack>
            </>
          )}

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VehiclesPage() {
  const qc = useQueryClient()
  const { show } = useToast()
  const navigate = useNavigate()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [toDelete, setToDelete] = useState<Vehicle | null>(null)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)

  const params = useMemo(
    () => ({
      limit: pageSize,
      offset: page * pageSize,
      status: statusFilter || undefined,
    }),
    [pageSize, page, statusFilter],
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: vehicleKeys.list(params),
    queryFn: () => listVehiclesPaged(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: vehicleKeys.all })
      setToDelete(null)
      show('Veículo excluído.')
    },
  })

  const vehicles = useMemo(() => {
    const items = data?.items ?? []
    if (!q.trim()) return items
    const lower = q.toLowerCase()
    return items.filter(
      (v) =>
        v.make.toLowerCase().includes(lower) ||
        v.model.toLowerCase().includes(lower) ||
        (v.nickname ?? '').toLowerCase().includes(lower) ||
        (v.plate ?? '').toLowerCase().includes(lower),
    )
  }, [data, q])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (v: Vehicle) => {
    setEditing(v)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Veículos"
        subtitle="Gerencie os veículos da frota familiar."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo veículo
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
            placeholder="Buscar por marca, modelo, placa…"
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
            sx={{ minWidth: { sm: 160 } }}
            emptyLabel="Todos"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v)
              setPage(0)
            }}
            options={VEHICLE_STATUS_OPTIONS}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={<DirectionsCarRoundedIcon />}
          title="Nenhum veículo encontrado"
          description={
            q || statusFilter
              ? 'Ajuste a busca ou o filtro de status.'
              : 'Cadastre o primeiro veículo da frota.'
          }
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo veículo
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Veículo</TableCell>
                  <TableCell>Ano</TableCell>
                  <TableCell>Placa</TableCell>
                  <TableCell>Combustível</TableCell>
                  <TableCell>Odômetro</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id} hover>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight={600}>
                          {v.nickname ?? `${v.make} ${v.model}`}
                        </Typography>
                        {v.nickname && (
                          <Typography variant="caption" color="text.secondary">
                            {v.make} {v.model}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{v.year_model}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{v.plate ?? '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {FUEL_TYPE_LABEL[v.fuel_type] ?? v.fuel_type}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>
                      {formatKM(v.current_odometer)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={VEHICLE_STATUS_LABEL[v.status]}
                        color={VEHICLE_STATUS_COLOR[v.status]}
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="Ver detalhes">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/dashboard/frota/veiculos/${v.id}`)}
                        >
                          <OpenInNewRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(v)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setToDelete(v)}
                        >
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
        <VehicleFormDialog
          open={formOpen}
          vehicle={editing}
          onClose={() => setFormOpen(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir veículo"
        description={`Tem certeza que deseja excluir "${toDelete?.nickname ?? `${toDelete?.make} ${toDelete?.model}`}"? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />
    </>
  )
}
