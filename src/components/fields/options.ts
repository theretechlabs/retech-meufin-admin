/**
 * Tipos e helpers das listas de opção dos campos de seleção
 * (AutocompleteField, MultiAutocompleteField, AsyncAutocompleteField).
 * Arquivo sem componentes de propósito: o fast refresh só funciona em
 * arquivos que exportam só componentes.
 */
export type AutocompleteOption = {
  value: string;
  label: string;
  /** Linha secundária exibida na lista (ex.: exemplos do grupo) — também pesquisável. */
  description?: string;
  /** Termos extras pesquisáveis que não aparecem na UI. */
  keywords?: string;
};

/** Busca acento-insensível e case-insensível. */
export function normalizeSearch(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Filtro padrão: casa label, descrição e keywords. */
export function matchesOption(o: AutocompleteOption, query: string): boolean {
  return normalizeSearch(
    `${o.label} ${o.description ?? ""} ${o.keywords ?? ""}`,
  ).includes(query);
}

/** Converte um mapa `valor → rótulo` (os *_LABEL das constants) em opções. */
export function optionsFromLabels<K extends string>(
  labels: Record<K, string>,
): AutocompleteOption[] {
  return (Object.keys(labels) as K[]).map((value) => ({
    value,
    label: labels[value],
  }));
}

/** Lista de opção de um array de `{ value, label }` com value numérico (mês, ano). */
export function numericOptions(
  items: readonly { value: number; label: string }[] | readonly number[],
): AutocompleteOption[] {
  return items.map((it) =>
    typeof it === "number"
      ? { value: String(it), label: String(it) }
      : { value: String(it.value), label: it.label },
  );
}

/** Filtro de situação (Todos/Ativos/Inativos) usado em toda tela de gestão. */
export const ACTIVE_FILTER_OPTIONS: AutocompleteOption[] = [
  { value: "true", label: "Ativos" },
  { value: "false", label: "Inativos" },
];
