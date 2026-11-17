import { useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AsyncAutocompleteField } from '@/components/fields/AsyncAutocompleteField'
import { ErrorState } from '@/features/health/components/StateViews'
import { createSupplier, getSupplier, listSuppliersPaged, type SupplierCategory } from '../api'
import { errorMessage, financeKeys } from '../constants'

/** Busca paginada de fornecedores ativos. */
async function searchSuppliers(query: string) {
  const { items } = await listSuppliersPaged({ query, limit: 20, offset: 0, active: true })
  return items.map((s) => ({ value: s.id, label: s.name }))
}

/** Rótulo do fornecedor já salvo (pode estar inativo; o GET por id resolve). */
async function resolveSupplier(id: string) {
  const s = await getSupplier(id)
  return { value: s.id, label: s.name }
}

/**
 * Seletor de fornecedor/credor com busca no servidor. Com `createCategory`,
 * oferece cadastrar um novo na hora (só o nome), já na categoria indicada —
 * para não mandar o usuário a outra tela no meio de um formulário.
 */
export function SupplierField({
  label,
  value,
  onChange,
  createCategory,
  createLabel = 'Cadastrar novo',
  helperText,
}: {
  label: string
  value: string
  onChange: (id: string) => void
  createCategory?: SupplierCategory
  createLabel?: string
  helperText?: string
}) {
  const qc = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const mutation = useMutation({
    mutationFn: () => createSupplier({ name: name.trim(), category: createCategory!, active: true }),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: financeKeys.suppliers() })
      onChange(created.id)
      setCreating(false)
      setName('')
    },
  })

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <AsyncAutocompleteField
          label={label}
          value={value}
          onChange={(v) => onChange(v)}
          queryKey={financeKeys.suppliers()}
          search={searchSuppliers}
          resolve={resolveSupplier}
          helperText={helperText}
        />
        {createCategory && (
          <Button
            variant="outlined"
            startIcon={<AddRoundedIcon />}
            onClick={() => setCreating(true)}
            // Mesma altura do campo ao lado (56px do input médio); o helperText
            // fica abaixo do campo e não entra na conta.
            sx={{ whiteSpace: 'nowrap', flexShrink: 0, height: 56 }}
          >
            {createLabel}
          </Button>
        )}
      </Stack>

      {creating && (
        <Dialog
          open
          onClose={mutation.isPending ? undefined : () => setCreating(false)}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ fontWeight: 800 }}>{createLabel}</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
              <TextField
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                fullWidth
                required
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button color="inherit" onClick={() => setCreating(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              onClick={() => mutation.mutate()}
              disabled={!name.trim() || mutation.isPending}
            >
              Cadastrar
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  )
}
