import type { AutocompleteOption } from '@/components/fields/options'
import { listMarkers, type Marker } from './api'

/** Rótulo do marcador nas listas: nome canônico (+ unidade canônica). */
export function markerOption(
  m: Pick<Marker, 'id' | 'canonical_name' | 'canonical_unit'>,
): AutocompleteOption {
  return {
    value: m.id,
    label: m.canonical_unit ? `${m.canonical_name} (${m.canonical_unit})` : m.canonical_name,
  }
}

/**
 * Busca no servidor da primeira página do catálogo para o termo digitado —
 * única fonte dos seletores de marcador (MarkerAutocomplete e importação de
 * exame). O catálogo cresce sem limite: nunca baixe a lista inteira.
 */
export async function searchMarkers(query: string, signal: AbortSignal): Promise<Marker[]> {
  const page = await listMarkers({ query, limit: 20, offset: 0 }, signal)
  return page.items
}
