import { useEffect } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import {
  createWarranty,
  updateWarranty,
  type Warranty,
  type WarrantyCategory,
  type WarrantyInput,
} from '../api'
import { centsToReais, errorMessage, reaisToCents, warrantyKeys } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { ErrorState } from '@/features/health/components/StateViews'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

type FormValues = {
  item_name: string
  category: WarrantyCategory
  brand: string
  model: string
  serial_number: string
  store: string
  supplier_name: string
  purchase_date: string
  price: string
  invoice_number: string
  legal_warranty_days: string
  contractual_warranty_months: string
  extended_warranty_months: string
  extended_provider: string
  extended_cost: string
  coverage_notes: string
  notes: string
}

function toDefaults(w?: Warranty | null): FormValues {
  return {
    item_name: w?.item_name ?? '',
    category: w?.category ?? 'eletronico',
    brand: w?.brand ?? '',
    model: w?.model ?? '',
    serial_number: w?.serial_number ?? '',
    store: w?.store ?? '',
    supplier_name: w?.supplier_name ?? '',
    purchase_date: w?.purchase_date?.slice(0, 10) ?? '',
    price: w?.price_cents != null ? String(centsToReais(w.price_cents)) : '',
    invoice_number: w?.invoice_number ?? '',
    legal_warranty_days: String(w?.legal_warranty_days ?? 90),
    contractual_warranty_months: String(w?.contractual_warranty_months ?? 12),
    extended_warranty_months: String(w?.extended_warranty_months ?? 0),
    extended_provider: w?.extended_provider ?? '',
    extended_cost: w?.extended_cost_cents ? String(centsToReais(w.extended_cost_cents)) : '',
    coverage_notes: w?.coverage_notes ?? '',
    notes: w?.notes ?? '',
  }
}

function numOrNull(v: string): number | null {
  const n = parseInt(v, 10)
  return Number.isNaN(n) ? null : n
}

function moneyToCents(v: string): number | null {
  const n = parseFloat(v.replace(',', '.'))
  return reaisToCents(Number.isNaN(n) ? null : n)
}

/** Dialog completo de criação/edição de garantia (inclui seção "Garantia estendida"). */
export function WarrantyFormDialog({
  warranty,
  onClose,
}: {
  warranty?: Warranty | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const editing = Boolean(warranty)
  const category = useCatalog('warranty.category')

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: toDefaults(warranty) })

  useEffect(() => {
    reset(toDefaults(warranty))
  }, [warranty, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: WarrantyInput = {
        item_name: values.item_name.trim(),
        category: values.category,
        brand: values.brand.trim() || null,
        model: values.model.trim() || null,
        serial_number: values.serial_number.trim() || null,
        store: values.store.trim() || null,
        supplier_name: values.supplier_name.trim() || null,
        purchase_date: values.purchase_date,
        price_cents: moneyToCents(values.price),
        invoice_number: values.invoice_number.trim() || null,
        legal_warranty_days: numOrNull(values.legal_warranty_days),
        contractual_warranty_months: numOrNull(values.contractual_warranty_months),
        extended_warranty_months: numOrNull(values.extended_warranty_months),
        extended_provider: values.extended_provider.trim() || null,
        extended_cost_cents: moneyToCents(values.extended_cost) ?? 0,
        coverage_notes: values.coverage_notes.trim() || null,
        notes: values.notes.trim() || null,
      }
      return editing ? updateWarranty(warranty!.id, input) : createWarranty(input)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: warrantyKeys.all })
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {editing ? 'Editar garantia' : 'Nova garantia'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="item_name"
              control={control}
              rules={{ required: 'Informe o nome do item' }}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Item"
                  placeholder="Ex.: Geladeira Brastemp Frost Free"
                  fullWidth
                  required
                  error={Boolean(errors.item_name)}
                  helperText={errors.item_name?.message}
                />
              )}
            />
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
                  sx={{ minWidth: 200 }}
                />
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
            <Controller
              name="serial_number"
              control={control}
              render={({ field }) => <TextField {...field} label="Número de série" fullWidth />}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="store"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Loja / marketplace"
                  placeholder="Ex.: Mercado Livre, Magalu"
                  fullWidth
                />
              )}
            />
            <Controller
              name="supplier_name"
              control={control}
              render={({ field }) => <TextField {...field} label="Fornecedor" fullWidth />}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="purchase_date"
              control={control}
              rules={{ required: 'Informe a data da compra' }}
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
            <Controller
              name="price"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Valor pago"
                  fullWidth
                  InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                />
              )}
            />
            <Controller
              name="invoice_number"
              control={control}
              render={({ field }) => <TextField {...field} label="Nº da nota fiscal" fullWidth />}
            />
          </Stack>

          <Divider textAlign="left">
            <Typography variant="overline" color="text.secondary">
              Prazos de garantia
            </Typography>
          </Divider>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="legal_warranty_days"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Garantia legal (dias)"
                  fullWidth
                  helperText="CDC: 90 dias para bens duráveis"
                />
              )}
            />
            <Controller
              name="contractual_warranty_months"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Garantia do fabricante (meses)"
                  fullWidth
                  helperText="Contratual — normalmente 12 meses"
                />
              )}
            />
          </Stack>

          <Divider textAlign="left">
            <Typography variant="overline" color="text.secondary">
              Garantia estendida
            </Typography>
          </Divider>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Controller
              name="extended_warranty_months"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Meses adicionais"
                  fullWidth
                  helperText="Somados após a garantia do fabricante"
                />
              )}
            />
            <Controller
              name="extended_provider"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Quem vendeu a estendida"
                  placeholder="Ex.: Garantia Mercado Livre"
                  fullWidth
                />
              )}
            />
            <Controller
              name="extended_cost"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  type="number"
                  label="Custo da estendida"
                  fullWidth
                  InputProps={{ startAdornment: <InputAdornment position="start">R$</InputAdornment> }}
                />
              )}
            />
          </Stack>

          <Controller
            name="coverage_notes"
            control={control}
            render={({ field }) => (
              <TextField {...field} label="O que a cobertura inclui" fullWidth multiline minRows={2} />
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
        <Button onClick={onClose} color="inherit">
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={mutation.isPending}>
          {mutation.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
