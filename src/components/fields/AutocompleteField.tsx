import {
  Autocomplete,
  TextField,
  Typography,
  Stack,
  type SxProps,
  type Theme,
} from "@mui/material";
import {
  matchesOption,
  normalizeSearch,
  type AutocompleteOption,
} from "./options";

export type AutocompleteFieldProps = {
  options: AutocompleteOption[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  /** Se definido, inclui a opção "vazio" (value '') com esse rótulo — ex.: "Todos", "Não informar". */
  emptyLabel?: string;
  size?: "small" | "medium";
  required?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  autoFocus?: boolean;
  /** Sem o "x" de limpar: para campos obrigatórios sem estado vazio válido. */
  disableClearable?: boolean;
  loading?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * Seletor padrão do sistema para listas em memória: enums, catálogos e
 * entidades limitadas (cartões, contas, membros). Digitar filtra por nome,
 * descrição E keywords — "cinema" acha o grupo "Lazer & Cultura" pelos
 * exemplos. Fechado, mostra só o label.
 *
 * Regra do projeto (CLAUDE.md): nenhuma página usa <TextField select>,
 * <Select> ou <Autocomplete> direto. Lista que cresce sem limite (fornecedores,
 * marcadores…) usa AsyncAutocompleteField; seleção múltipla usa
 * MultiAutocompleteField.
 */
export function AutocompleteField({
  options,
  value,
  onChange,
  label,
  placeholder,
  emptyLabel,
  size,
  required,
  fullWidth = true,
  disabled,
  error,
  helperText,
  autoFocus,
  disableClearable,
  loading,
  sx,
}: AutocompleteFieldProps) {
  const all: AutocompleteOption[] = emptyLabel
    ? [{ value: "", label: emptyLabel }, ...options]
    : options;

  const selected = all.find((o) => o.value === value) ?? null;

  return (
    <Autocomplete
      options={all}
      value={selected}
      onChange={(_, opt) => onChange(opt?.value ?? "")}
      getOptionLabel={(o) => o.label}
      isOptionEqualToValue={(o, v) => o.value === v.value}
      disabled={disabled}
      disableClearable={disableClearable}
      loading={loading}
      size={size}
      fullWidth={fullWidth}
      sx={sx}
      noOptionsText="Nada encontrado"
      filterOptions={(opts, state) => {
        const q = normalizeSearch(state.inputValue.trim());
        if (!q) return opts;
        return opts.filter((o) => matchesOption(o, q));
      }}
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
        />
      )}
    />
  );
}
