import { useQueryClient } from '@tanstack/react-query'
import { AsyncAutocompleteField } from '@/components/fields/AsyncAutocompleteField'
import { getMarker, type Marker } from '../api'
import { healthKeys } from '../constants'
import { markerOption, searchMarkers } from '../markerOptions'

/**
 * Busca de marcador no catálogo (servidor) que devolve o Marker completo —
 * o chamador precisa da unidade canônica, não só do id. Os marcadores de cada
 * página buscada entram no cache por id; um id fora dele busca o registro.
 */
export function MarkerAutocomplete({
  value,
  onChange,
  label = 'Marcador (catálogo)',
  size = 'small',
}: {
  value: Marker | null
  onChange: (marker: Marker | null) => void
  label?: string
  size?: 'small' | 'medium'
}) {
  const qc = useQueryClient()

  return (
    <AsyncAutocompleteField
      label={label}
      size={size}
      minChars={2}
      value={value?.id ?? ''}
      queryKey={healthKeys.markers({ ctx: 'autocomplete' })}
      search={async (query, signal) => {
        const items = await searchMarkers(query, signal)
        items.forEach((m) => qc.setQueryData(healthKeys.marker(m.id), m))
        return items.map(markerOption)
      }}
      resolve={async (id) => (value?.id === id ? markerOption(value) : null)}
      onChange={(id) => {
        if (!id) {
          onChange(null)
          return
        }
        void qc
          .fetchQuery({
            queryKey: healthKeys.marker(id),
            queryFn: () => getMarker(id),
            staleTime: Infinity,
          })
          .then(onChange)
      }}
    />
  )
}
