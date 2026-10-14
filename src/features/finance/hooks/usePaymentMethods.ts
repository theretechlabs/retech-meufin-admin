import { useMemo } from 'react'
import { useCatalog, type Catalog } from '@/lib/catalogs/useCatalog'
import { SYSTEM_ONLY_PAYMENT_METHODS } from '../constants'

/**
 * Catálogo `finance.payment_method` (rótulos da API) mais `manualOptions`:
 * as formas que o usuário pode escolher numa liquidação. `compensacao` só o
 * sistema grava (quitação/venda numa troca de bem), então fica fora do select
 * mas continua resolvendo rótulo via `labelOf`.
 */
export function usePaymentMethods(): Catalog & { manualOptions: Catalog['options'] } {
  const catalog = useCatalog('finance.payment_method')
  const manualOptions = useMemo(
    () => catalog.options.filter((o) => !SYSTEM_ONLY_PAYMENT_METHODS.has(o.value)),
    [catalog.options],
  )
  return { ...catalog, manualOptions }
}
