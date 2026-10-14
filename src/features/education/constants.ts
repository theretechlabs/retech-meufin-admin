import type { ListStatus } from './api'

/** Ano corrente no fuso local: padrão dos filtros e formulários de ano letivo. */
export const CURRENT_YEAR = new Date().getFullYear()

export const educationKeys = {
  all: ['education'] as const,
  dashboard: (year?: number) => [...educationKeys.all, 'dashboard', year ?? 'latest'] as const,
  enrollments: (params: Record<string, unknown>) =>
    [...educationKeys.all, 'enrollments', params] as const,
  enrollment: (id: string) => [...educationKeys.all, 'enrollment', id] as const,
  lists: (params: Record<string, unknown>) => [...educationKeys.all, 'lists', params] as const,
  list: (id: string) => [...educationKeys.all, 'list', id] as const,
}

export const LIST_STATUS_COLOR: Record<ListStatus, 'default' | 'warning' | 'success'> = {
  planejada: 'default',
  em_compra: 'warning',
  concluida: 'success',
}

// ─── Formatters ─────────────────────────────────────────────────────────────────

/** Converte centavos (BIGINT no back) para BRL. */
export function formatCents(cents?: number | null): string {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Converte BRL (reais, com casas decimais) para centavos inteiros. */
export function toCents(reais: number | string): number {
  const n = typeof reais === 'string' ? parseFloat(reais.replace(',', '.')) : reais
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

/** Converte centavos para número em reais (para inputs). */
export function centsToReais(cents?: number | null): number {
  if (cents == null) return 0
  return cents / 100
}

export function formatDate(s?: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function formatPct(v?: number | null): string {
  if (v == null) return '—'
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
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
