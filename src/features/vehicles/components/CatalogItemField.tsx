import { useState } from 'react'
import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { searchCatalog, type MaintenanceCatalogItem } from '../api'
import { vehicleKeys } from '../constants'

/**
 * Item / serviço de uma ordem de serviço, buscado no catálogo de manutenção
 * (servidor, agrupado por categoria).
 *
 * Único uso direto de `Autocomplete` fora de `@/components/fields`, e por um
 * motivo: `freeSolo` — o usuário pode digitar um item fora do catálogo. Os
 * campos compartilhados (AutocompleteField/AsyncAutocompleteField) trabalham
 * com `value: string` = id de uma opção e não têm esse modo.
 *
 * `categoryLabel` é o `labelOf` do catálogo `vehicle.os_item_category`,
 * passado pelo componente chamador (agrupa as opções por categoria).
 */
export function CatalogItemField({
  categoryLabel,
  defaultValue,
  onSelect,
  onType,
}: {
  categoryLabel: (slug: string) => string
  defaultValue: string
  onSelect: (item: MaintenanceCatalogItem) => void
  onType: (text: string) => void
}) {
  const [inputVal, setInputVal] = useState(defaultValue)
  const [open, setOpen] = useState(false)

  const { data: opts = [] } = useQuery({
    queryKey: vehicleKeys.catalog(inputVal, ''),
    queryFn: () => searchCatalog(inputVal, '', 30),
    enabled: open && inputVal.length >= 1,
    staleTime: 60_000,
    placeholderData: (prev: MaintenanceCatalogItem[] | undefined) => prev ?? [],
  })

  return (
    <Autocomplete
      freeSolo
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={opts}
      getOptionLabel={(o) => (typeof o === 'string' ? o : o.name)}
      groupBy={(o) => (typeof o === 'string' ? '' : categoryLabel(o.category))}
      filterOptions={(x) => x}
      noOptionsText={inputVal.length < 1 ? 'Digite para buscar' : 'Nenhum item encontrado'}
      inputValue={inputVal}
      onInputChange={(_, v, reason) => {
        setInputVal(v)
        if (reason === 'input') onType(v)
      }}
      onChange={(_, v) => {
        if (v && typeof v !== 'string') {
          setInputVal(v.name)
          onSelect(v)
        } else if (v === null) {
          setInputVal('')
          onType('')
        }
      }}
      renderOption={(props, o) => {
        const item = o as MaintenanceCatalogItem
        return (
          <Box component="li" {...props} key={item.id}>
            <Stack>
              <Typography variant="body2" fontWeight={500}>{item.name}</Typography>
              {item.description && (
                <Typography variant="caption" color="text.secondary">{item.description}</Typography>
              )}
            </Stack>
          </Box>
        )
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          size="small"
          label="Item / Serviço *"
          required
          placeholder="Buscar no catálogo..."
          helperText="Selecione do catálogo ou descreva livremente"
        />
      )}
    />
  )
}
