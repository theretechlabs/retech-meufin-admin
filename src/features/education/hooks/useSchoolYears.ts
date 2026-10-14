import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listEnrollments } from '../api'
import { CURRENT_YEAR, educationKeys } from '../constants'

/**
 * Anos letivos disponíveis para filtro: o ano corrente mais todos os anos que
 * já têm matrícula, em ordem decrescente. Usa a lista completa de matrículas
 * (cache compartilhado com o painel e as listas de material), nunca a lista já
 * filtrada — assim o filtro de ano não "encolhe" depois de escolher um ano.
 */
export function useSchoolYears(): number[] {
  const { data } = useQuery({
    queryKey: educationKeys.enrollments({}),
    queryFn: () => listEnrollments(),
  })

  return useMemo(() => {
    const set = new Set<number>([CURRENT_YEAR])
    ;(data ?? []).forEach((e) => set.add(e.school_year))
    return Array.from(set).sort((a, b) => b - a)
  }, [data])
}
