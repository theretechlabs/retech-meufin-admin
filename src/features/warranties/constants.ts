import type { WarrantyCategory, WarrantyStatus } from './api'

export const warrantyKeys = {
  all: ['warranties'] as const,
  list: (params: Record<string, unknown>) => [...warrantyKeys.all, 'list', params] as const,
  detail: (id: string) => [...warrantyKeys.all, 'detail', id] as const,
  summary: () => [...warrantyKeys.all, 'summary'] as const,
  documents: (warrantyId: string) => [...warrantyKeys.all, 'documents', warrantyId] as const,
}

export const CATEGORY_ICON: Record<WarrantyCategory, string> = {
  eletrodomestico: '🧊',
  eletronico: '📺',
  informatica: '💻',
  celular: '📱',
  movel: '🛋️',
  veiculo: '🚗',
  imovel: '🏠',
  ferramenta: '🔧',
  brinquedo: '🧸',
  esporte: '⚽',
  outros: '📦',
}

export const STATUS_COLOR: Record<WarrantyStatus, 'success' | 'warning' | 'error'> = {
  vigente: 'success',
  expira_em_breve: 'warning',
  expirada: 'error',
}

/** Converte centavos (BIGINT do backend) para string em BRL. */
export function formatMoneyCents(cents?: number | null): string {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Converte reais (input do usuário) para centavos inteiros. */
export function reaisToCents(reais?: number | null): number | null {
  if (reais == null || Number.isNaN(reais)) return null
  return Math.round(reais * 100)
}

/** Converte centavos para reais (para preencher o input de edição). */
export function centsToReais(cents?: number | null): number | null {
  if (cents == null) return null
  return cents / 100
}

export function formatDate(s?: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * Percentual decorrido do tempo de garantia (0–100) para a barra de progresso.
 * 100 = totalmente decorrida (expirada).
 */
export function warrantyProgressPct(purchaseDate: string, expiresAt: string): number {
  const start = new Date(purchaseDate).getTime()
  const end = new Date(expiresAt).getTime()
  const now = Date.now()
  if (end <= start) return 100
  const pct = ((now - start) / (end - start)) * 100
  return Math.max(0, Math.min(100, pct))
}

export function errorMessage(err: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  if (typeof err === 'object' && err != null) {
    const anyErr = err as {
      response?: { data?: { error?: string | { message?: string }; message?: string } }
      message?: string
    }
    const apiErr = anyErr.response?.data?.error
    if (typeof apiErr === 'string' && apiErr) return apiErr
    if (apiErr && typeof apiErr === 'object' && typeof apiErr.message === 'string' && apiErr.message) {
      return apiErr.message
    }
    return anyErr.response?.data?.message ?? anyErr.message ?? fallback
  }
  return fallback
}
