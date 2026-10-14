import { useMemo, useState } from 'react'
import {
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { MoneyField } from '@/components/fields/MoneyField'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { numericOptions } from '@/components/fields/options'
import {
  createTax,
  deleteTax,
  listProperties,
  listTaxes,
  payTax,
  updateTax,
  type AssetTax,
  type AssetTaxInput,
} from '../api'
import { listVehiclesPaged } from '@/features/vehicles/api'
import {
  ASSET_TYPE_OPTIONS,
  errorMessage,
  formatCents,
  formatDate,
  patrimonyKeys,
  TAX_STATUS_COLOR,
  TAX_STATUS_LABEL,
  TAX_STATUS_OPTIONS,
  TAX_TYPE_LABEL,
  TAX_TYPE_OPTIONS,
} from '../constants'
import { PageHeader } from '@/features/health/components/PageHeader'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

const CURRENT_YEAR = new Date().getFullYear()
const YEAR_OPTIONS = numericOptions(Array.from({ length: 8 }, (_, i) => CURRENT_YEAR + 1 - i))

type FormValues = {
  asset_type: string
  property_id: string
  vehicle_id: string
  tax_type: string
  reference_year: string
  description: string
  due_date: string
  amount_cents: string
  installments_total: string
  installment_number: string
  notes: string
}

const emptyForm: FormValues = {
  asset_type: 'property',
  property_id: '',
  vehicle_id: '',
  tax_type: 'iptu',
  reference_year: String(CURRENT_YEAR),
  description: '',
  due_date: '',
  amount_cents: '',
  installments_total: '1',
  installment_number: '1',
  notes: '',
}

function mapTaxToForm(t: AssetTax): FormValues {
  return {
    asset_type: t.asset_type,
    property_id: t.property_id ?? '',
    vehicle_id: t.vehicle_id ?? '',
    tax_type: t.tax_type,
    reference_year: String(t.reference_year),
    description: t.description ?? '',
    due_date: t.due_date ?? '',
    amount_cents: String(t.amount_cents),
    installments_total: String(t.installments_total),
    installment_number: String(t.installment_number),
    notes: t.notes ?? '',
  }
}

function maskToCents(masked: string): number {
  const digits = String(masked).replace(/\D/g, '')
  return digits ? Number(digits) : 0
}

function TaxFormDialog({
  open,
  tax,
  onClose,
}: {
  open: boolean
  tax: AssetTax | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const isEdit = Boolean(tax)

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ values: tax ? mapTaxToForm(tax) : emptyForm })

  const assetType = useWatch({ control, name: 'asset_type' })

  const propertiesQuery = useQuery({
    queryKey: patrimonyKeys.properties({ selector: true }),
    queryFn: () => listProperties({ limit: 200 }),
  })
  const vehiclesQuery = useQuery({
    queryKey: ['vehicles', 'selector'],
    queryFn: () => listVehiclesPaged({ limit: 200, offset: 0 }),
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: AssetTaxInput = {
        asset_type: values.asset_type,
        property_id: values.asset_type === 'property' ? values.property_id || null : null,
        vehicle_id: values.asset_type === 'vehicle' ? values.vehicle_id || null : null,
        tax_type: values.tax_type,
        reference_year: parseInt(values.reference_year) || CURRENT_YEAR,
        description: values.description.trim() || null,
        due_date: values.due_date || null,
        amount_cents: maskToCents(values.amount_cents),
        installments_total: parseInt(values.installments_total) || 1,
        installment_number: parseInt(values.installment_number) || 1,
        notes: values.notes.trim() || null,
      }
      if (isEdit && tax) return updateTax(tax.id, input)
      return createTax(input)
    },
    onSuccess: () => {
      show(isEdit ? 'Imposto atualizado.' : 'Imposto cadastrado.')
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      reset(emptyForm)
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{isEdit ? 'Editar imposto' : 'Novo imposto'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="asset_type"
              control={control}
              render={({ field }) => (
                <AutocompleteField
                  label="Bem"
                  value={field.value}
                  onChange={field.onChange}
                  options={ASSET_TYPE_OPTIONS}
                  disableClearable
                />
              )}
            />
            <Controller
              name="tax_type"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <AutocompleteField
                  label="Tipo de imposto"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={TAX_TYPE_OPTIONS}
                  disableClearable
                />
              )}
            />
          </Stack>

          {assetType === 'property' ? (
            <Controller
              name="property_id"
              control={control}
              rules={{ required: 'Selecione o imóvel' }}
              render={({ field }) => (
                <AutocompleteField
                  label="Imóvel"
                  required
                  error={Boolean(errors.property_id)}
                  helperText={errors.property_id?.message}
                  loading={propertiesQuery.isLoading}
                  value={field.value}
                  onChange={field.onChange}
                  options={(propertiesQuery.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
                />
              )}
            />
          ) : (
            <Controller
              name="vehicle_id"
              control={control}
              rules={{ required: 'Selecione o veículo' }}
              render={({ field }) => (
                <AutocompleteField
                  label="Veículo"
                  required
                  error={Boolean(errors.vehicle_id)}
                  helperText={errors.vehicle_id?.message}
                  loading={vehiclesQuery.isLoading}
                  value={field.value}
                  onChange={field.onChange}
                  options={(vehiclesQuery.data?.items ?? []).map((v) => ({
                    value: v.id,
                    label: v.nickname ?? `${v.make} ${v.model}`,
                  }))}
                />
              )}
            />
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="reference_year"
              control={control}
              rules={{ required: true }}
              render={({ field }) => (
                <AutocompleteField
                  label="Ano de referência"
                  fullWidth={false}
                  sx={{ minWidth: 160 }}
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={YEAR_OPTIONS}
                  disableClearable
                />
              )}
            />
            <Controller
              name="amount_cents"
              control={control}
              render={({ field }) => <MoneyField {...field} label="Valor" fullWidth />}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="due_date"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Vencimento"
                  type="date"
                  fullWidth
                  InputLabelProps={{ shrink: true }}
                />
              )}
            />
            <Controller
              name="installment_number"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="Parcela" type="number" sx={{ minWidth: 110 }} inputProps={{ min: 1 }} />
              )}
            />
            <Controller
              name="installments_total"
              control={control}
              render={({ field }) => (
                <TextField {...field} label="de" type="number" sx={{ minWidth: 110 }} inputProps={{ min: 1 }} />
              )}
            />
          </Stack>

          <Controller
            name="description"
            control={control}
            render={({ field }) => <TextField {...field} label="Descrição" fullWidth />}
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
          {isEdit ? 'Salvar' : 'Cadastrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function AssetTaxesPage() {
  const qc = useQueryClient()
  const { show } = useToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AssetTax | null>(null)
  const [toDelete, setToDelete] = useState<AssetTax | null>(null)
  const [toPay, setToPay] = useState<AssetTax | null>(null)

  const [yearFilter, setYearFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const params = useMemo(
    () => ({
      limit: 200,
      offset: 0,
      reference_year: yearFilter ? Number(yearFilter) : undefined,
      tax_type: typeFilter || undefined,
      status: statusFilter || undefined,
    }),
    [yearFilter, typeFilter, statusFilter],
  )

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: patrimonyKeys.taxes(params),
    queryFn: () => listTaxes(params),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteTax(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      setToDelete(null)
      show('Imposto excluído.')
    },
  })

  const payMutation = useMutation({
    mutationFn: (tax: AssetTax) => payTax(tax.id, { paid_cents: tax.amount_cents }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      setToPay(null)
      show('Imposto marcado como pago.')
    },
  })

  const taxes = data?.items ?? []

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }
  const openEdit = (t: AssetTax) => {
    setEditing(t)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Impostos de bens"
        subtitle="IPTU, IPVA, condomínio e outras taxas dos imóveis e veículos da família."
        action={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
            Novo imposto
          </Button>
        }
      />

      <Card sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <AutocompleteField
            label="Ano"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 140 } }}
            emptyLabel="Todos"
            value={yearFilter}
            onChange={setYearFilter}
            options={YEAR_OPTIONS}
          />
          <AutocompleteField
            label="Tipo"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 180 } }}
            emptyLabel="Todos"
            value={typeFilter}
            onChange={setTypeFilter}
            options={TAX_TYPE_OPTIONS}
          />
          <AutocompleteField
            label="Status"
            size="small"
            fullWidth={false}
            sx={{ minWidth: { sm: 160 } }}
            emptyLabel="Todos"
            value={statusFilter}
            onChange={setStatusFilter}
            options={TAX_STATUS_OPTIONS}
          />
        </Stack>
      </Card>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : taxes.length === 0 ? (
        <EmptyState
          icon={<RequestQuoteRoundedIcon />}
          title="Nenhum imposto encontrado"
          description="Cadastre os impostos e taxas dos seus bens para acompanhar vencimentos e inflação."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={openCreate}>
              Novo imposto
            </Button>
          }
        />
      ) : (
        <Card>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Ano</TableCell>
                  <TableCell>Vencimento</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell align="right">Pago</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {taxes.map((t) => (
                  <TableRow key={t.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>
                        {TAX_TYPE_LABEL[t.tax_type]}
                      </Typography>
                      {t.description && (
                        <Typography variant="caption" color="text.secondary">
                          {t.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{t.reference_year}</TableCell>
                    <TableCell sx={{ color: 'text.secondary' }}>{formatDate(t.due_date)}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>
                      {formatCents(t.amount_cents)}
                    </TableCell>
                    <TableCell align="right" sx={{ color: 'text.secondary' }}>
                      {formatCents(t.paid_cents)}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={TAX_STATUS_LABEL[t.status]}
                        color={TAX_STATUS_COLOR[t.status]}
                        variant="filled"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {t.status !== 'paid' && (
                        <Tooltip title="Marcar como pago">
                          <IconButton size="small" color="success" onClick={() => setToPay(t)}>
                            <PaidRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => openEdit(t)}>
                          <EditRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Excluir">
                        <IconButton size="small" color="error" onClick={() => setToDelete(t)}>
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

      {formOpen && <TaxFormDialog open={formOpen} tax={editing} onClose={() => setFormOpen(false)} />}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Excluir imposto"
        description={`Excluir o ${toDelete ? TAX_TYPE_LABEL[toDelete.tax_type] : ''} de ${toDelete?.reference_year}? Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => toDelete && deleteMutation.mutate(toDelete.id)}
        onClose={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(toPay)}
        title="Marcar como pago"
        description={`Registrar o pagamento integral (${toPay ? formatCents(toPay.amount_cents) : ''}) do ${toPay ? TAX_TYPE_LABEL[toPay.tax_type] : ''} de ${toPay?.reference_year}?`}
        loading={payMutation.isPending}
        onConfirm={() => toPay && payMutation.mutate(toPay)}
        onClose={() => setToPay(null)}
      />
    </>
  )
}
