import { useState } from 'react'
import { Autocomplete, CircularProgress, TextField, Typography, Stack } from '@mui/material'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { AutocompleteOption } from './options'

export type AsyncAutocompleteFieldProps = {
  label: string
  /** Id selecionado ('' = nada). */
  value: string
  onChange: (value: string, option: AutocompleteOption | null) => void
  /** Prefixo da chave de cache (react-query); o termo digitado é anexado. */
  queryKey: readonly unknown[]
  /** Busca no servidor: termo (já com debounce) → opções da primeira página. */
  search: (query: string, signal: AbortSignal) => Promise<AutocompleteOption[]>
  /**
   * Rótulo do valor já selecionado quando ele não está na página atual
   * (edição de registro existente). Sem isto, o campo mostra o id.
   */
  resolve?: (value: string, signal: AbortSignal) => Promise<AutocompleteOption | null>
  /** Mínimo de caracteres para buscar; 0 = lista a primeira página ao abrir. */
  minChars?: number
  debounceMs?: number
  placeholder?: string
  size?: 'small' | 'medium'
  required?: boolean
  fullWidth?: boolean
  disabled?: boolean
  error?: boolean
  helperText?: string
  autoFocus?: boolean
  /** Agrupa a lista pelo rótulo devolvido (ex.: categoria do item). */
  groupBy?: (option: AutocompleteOption) => string
}

/**
 * Seletor com busca no servidor, para listas que crescem sem limite
 * (fornecedores, marcadores, catálogo de peças, veículos…). A API faz a
 * busca (`query`) e a paginação (`limit`); aqui só a primeira página é
 * exibida — digitar refina. Debounce e cache por termo.
 */
export function AsyncAutocompleteField({
  label,
  value,
  onChange,
  queryKey,
  search,
  resolve,
  minChars = 0,
  debounceMs = 300,
  placeholder,
  size,
  required,
  fullWidth = true,
  disabled,
  error,
  helperText,
  autoFocus,
  groupBy,
}: AsyncAutocompleteFieldProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const term = useDebouncedValue(input.trim(), debounceMs)
  const enabled = open && term.length >= minChars

  const { data: options = [], isFetching } = useQuery({
    queryKey: [...queryKey, 'autocomplete', term],
    queryFn: ({ signal }) => search(term, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })

  // Rótulo do selecionado: última escolha → página atual → resolve(id).
  const [picked, setPicked] = useState<AutocompleteOption | null>(null)
  const fromList = options.find((o) => o.value === value) ?? null
  const needResolve = Boolean(value) && !fromList && picked?.value !== value && Boolean(resolve)
  const resolved = useQuery({
    queryKey: [...queryKey, 'autocomplete', 'resolve', value],
    queryFn: ({ signal }) => resolve!(value, signal),
    enabled: needResolve,
    staleTime: Infinity,
  })
  const selected: AutocompleteOption | null = !value
    ? null
    : picked?.value === value
      ? picked
      : (fromList ?? resolved.data ?? { value, label: resolved.isFetching ? '…' : value })

  // MUI avisa se o valor não está nas opções: garante presença.
  const listed =
    selected && !options.some((o) => o.value === selected.value) ? [selected, ...options] : options

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      options={listed}
      value={selected}
      onChange={(_, opt) => {
        setPicked(opt)
        onChange(opt?.value ?? '', opt)
      }}
      onInputChange={(_, v) => setInput(v)}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      groupBy={groupBy}
      filterOptions={(x) => x}
      loading={isFetching}
      disabled={disabled}
      size={size}
      fullWidth={fullWidth}
      noOptionsText={
        term.length < minChars
          ? `Digite ao menos ${minChars} ${minChars === 1 ? 'caractere' : 'caracteres'}`
          : 'Nada encontrado'
      }
      renderOption={(props, o) => (
        <li {...props} key={o.value}>
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
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          required={required}
          error={error}
          helperText={helperText}
          autoFocus={autoFocus}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {isFetching ? <CircularProgress size={16} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  )
}
