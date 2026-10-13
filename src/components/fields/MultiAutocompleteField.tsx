import { Autocomplete, Checkbox, Chip, TextField, Typography, Stack } from '@mui/material'
import { matchesOption, normalizeSearch, type AutocompleteOption } from './options'

/**
 * Seleção múltipla em memória (grupos de um usuário, marcadores de um painel).
 * Mesma busca do AutocompleteField; selecionados viram chips.
 */
export function MultiAutocompleteField({
  options,
  value,
  onChange,
  label,
  placeholder,
  size,
  required,
  fullWidth = true,
  disabled,
  error,
  helperText,
  limitTags = 3,
}: {
  options: AutocompleteOption[]
  value: string[]
  onChange: (values: string[]) => void
  label: string
  placeholder?: string
  size?: 'small' | 'medium'
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
  error?: boolean
  helperText?: string
  limitTags?: number
}) {
  const selected = options.filter((o) => value.includes(o.value))

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      limitTags={limitTags}
      options={options}
      value={selected}
      onChange={(_, opts) => onChange(opts.map((o) => o.value))}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      disabled={disabled}
      size={size}
      fullWidth={fullWidth}
      noOptionsText="Nada encontrado"
      filterOptions={(opts, state) => {
        const q = normalizeSearch(state.inputValue.trim())
        if (!q) return opts
        return opts.filter((o) => matchesOption(o, q))
      }}
      renderOption={(props, o, { selected: isSelected }) => (
        <li {...props} key={o.value}>
          <Checkbox size="small" checked={isSelected} sx={{ mr: 1, p: 0 }} />
          <Stack sx={{ py: 0.25 }}>
            <span>{o.label}</span>
            {o.description && (
              <Typography variant="caption" color="text.secondary">
                {o.description}
              </Typography>
            )}
          </Stack>
        </li>
      )}
      renderValue={(items, getItemProps) =>
        items.map((o, index) => (
          <Chip {...getItemProps({ index })} key={o.value} label={o.label} size="small" />
        ))
      }
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required && value.length === 0}
          error={error}
          helperText={helperText}
        />
      )}
    />
  )
}
