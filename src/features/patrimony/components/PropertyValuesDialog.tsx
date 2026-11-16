import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Controller, useForm } from 'react-hook-form'
import { MoneyField } from '@/components/fields/MoneyField'
import { ErrorState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { propertyToInput, updateProperty, type Property } from '../api'
import { errorMessage, maskToCents, patrimonyKeys } from '../constants'

type FormValues = {
  purchase_date: string
  purchase_value_cents: string
  current_value_cents: string
}

/** Valores do imóvel: quanto custou, quando, e quanto vale hoje. Tudo opcional. */
export function PropertyValuesDialog({ property, onClose }: { property: Property; onClose: () => void }) {
  const qc = useQueryClient()
  const { show } = useToast()

  const { control, handleSubmit } = useForm<FormValues>({
    defaultValues: {
      purchase_date: property.purchase_date ?? '',
      purchase_value_cents:
        property.purchase_value_cents != null ? String(property.purchase_value_cents) : '',
      current_value_cents: property.current_value_cents != null ? String(property.current_value_cents) : '',
    },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateProperty(property.id, {
        ...propertyToInput(property),
        purchase_date: values.purchase_date || null,
        purchase_value_cents: maskToCents(values.purchase_value_cents),
        current_value_cents: maskToCents(values.current_value_cents),
      }),
    onSuccess: () => {
      show('Valores atualizados.')
      qc.invalidateQueries({ queryKey: patrimonyKeys.all })
      onClose()
    },
  })

  const submit = handleSubmit((values) => mutation.mutate(values))

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Valores do imóvel</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
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
            render={({ field }) => (
              <MoneyField
                {...field}
                label="Valor atual"
                fullWidth
                helperText="Quanto o imóvel vale hoje (avaliação ou estimativa)."
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
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
