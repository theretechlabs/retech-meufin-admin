import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AutocompleteOption } from '@/components/fields/options'
import { listCatalogs, type CatalogItem, type CatalogKey } from './api'

export const catalogsQueryKey = ['catalogs'] as const

const EMPTY: CatalogItem[] = []

/**
 * Todos os catálogos de enum do domínio, carregados uma vez por sessão.
 * Chame no layout autenticado para pré-carregar; `useCatalog` reaproveita.
 */
export function useCatalogs() {
  return useQuery({
    queryKey: catalogsQueryKey,
    queryFn: listCatalogs,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/** Pré-carrega os catálogos (ex.: logo após o login). */
export function usePrefetchCatalogs() {
  const qc = useQueryClient()
  return () => qc.prefetchQuery({ queryKey: catalogsQueryKey, queryFn: listCatalogs, staleTime: Infinity })
}

export type Catalog = {
  items: CatalogItem[]
  /** Opções prontas para AutocompleteField (slug → value, name → label, description). */
  options: AutocompleteOption[]
  /** Rótulo de um slug; enquanto carrega (ou slug desconhecido) devolve o próprio slug. */
  labelOf: (slug?: string | null) => string
  isLoading: boolean
}

/**
 * Um catálogo pelo nome. Substitui as constantes `X_OPTIONS` / `X_LABEL` do
 * admin: o rótulo é da API (fonte única), o admin só exibe.
 *
 *   const paymentMethod = useCatalog('finance.payment_method')
 *   <AutocompleteField options={paymentMethod.options} ... />
 *   {paymentMethod.labelOf(entry.payment_method)}
 */
export function useCatalog(key: CatalogKey): Catalog {
  const { data, isLoading } = useCatalogs()
  const items = data?.catalogs[key] ?? EMPTY
  return useMemo(() => {
    const map = new Map(items.map((it) => [it.slug, it.name]))
    return {
      items,
      options: items.map((it) => ({ value: it.slug, label: it.name, description: it.description })),
      labelOf: (slug) => (slug ? (map.get(slug) ?? slug) : '—'),
      isLoading,
    }
  }, [items, isLoading])
}
