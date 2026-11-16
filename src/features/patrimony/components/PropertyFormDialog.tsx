import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { ErrorState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { createProperty, propertyToInput, updateProperty, type Property } from '../api'
import { errorMessage, patrimonyKeys } from '../constants'

type FormValues = {
  name: string
  property_type: string
  address: string
  city: string
  state: string
  zip_code: string
  registration_number: string
  area_m2: string
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
    notes: p.notes ?? '',
  }
}

/**
 * Cadastro do imóvel: só a identificação (nome, tipo, localização, matrícula).
 * Valores e financiamento ficam na página do imóvel — só nome e tipo são
 * obrigatórios aqui.
 */
export function PropertyFormDialog({
  property,
  onClose,
  onCreated,
}: {
  property: Property | null
  onClose: () => void
  /** Imóvel recém-cadastrado: quem chama decide para onde ir (ex.: abrir o detalhe). */
  onCreated?: (created: Property) => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const propertyType = useCatalog('patrimony.property_type')

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    values: property ? mapPropertyToForm(property) : emptyForm,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const fields = {
        name: values.name.trim(),
        property_type: values.property_type,
        address: values.address.trim() || null,
        city: values.city.trim() || null,
        state: values.state.trim().toUpperCase() || null,
        zip_code: values.zip_code.trim() || null,
        registration_number: values.registration_number.trim() || null,
        area_m2: values.area_m2 ? parseFloat(values.area_m2.replace(',', '.')) || null : null,
        notes: values.notes.trim() || null,
      }
      // O PUT substitui o imóvel inteiro: os valores (editados na página do
      // imóvel) seguem como estão.
      if (property)
        return updateProperty(property.id, {
          ...propertyToInput(property),
          ...fields,
        })
      return createProperty(fields)
    },
    onSuccess: (saved) => {
      show(property ? 'Imóvel atualizado com sucesso.' : 'Imóvel cadastrado com sucesso.')
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      onClose()
      if (!property) onCreated?.(saved)
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{property ? 'Editar imóvel' : 'Novo imóvel'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>
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
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller
                name="property_type"
                control={control}
                rules={{ required: true }}
                render={({ field }) => (
                  <AutocompleteField
                    label="Tipo"
                    required
                    value={field.value}
                    onChange={field.onChange}
                    options={propertyType.options}
                    loading={propertyType.isLoading}
                    disableClearable
                  />
                )}
              />
            </Grid>
          </Grid>

          <Divider />
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            LOCALIZAÇÃO (OPCIONAL)
          </Typography>

          <Controller
            name="address"
            control={control}
            render={({ field }) => <TextField {...field} label="Endereço" fullWidth />}
          />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="city"
                control={control}
                render={({ field }) => <TextField {...field} label="Cidade" fullWidth />}
              />
            </Grid>
            <Grid size={{ xs: 4, sm: 2 }}>
              <Controller
                name="state"
                control={control}
                render={({ field }) => (
                  <TextField {...field} label="UF" fullWidth inputProps={{ maxLength: 2 }} />
                )}
              />
            </Grid>
            <Grid size={{ xs: 8, sm: 4 }}>
              <Controller
                name="zip_code"
                control={control}
                render={({ field }) => <TextField {...field} label="CEP" fullWidth />}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 8 }}>
              <Controller
                name="registration_number"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Matrícula"
                    fullWidth
                    placeholder="Nº da matrícula no cartório"
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller
                name="area_m2"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    label="Área (m²)"
                    fullWidth
                    type="number"
                    inputProps={{ min: 0, step: '0.01' }}
                  />
                )}
              />
            </Grid>
          </Grid>

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
          {property ? 'Salvar' : 'Cadastrar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
