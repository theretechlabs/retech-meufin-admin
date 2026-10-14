import type { TaxStatus } from './api'

export const patrimonyKeys = {
  all: ['patrimony'] as const,
  properties: (params: Record<string, unknown>) => [...patrimonyKeys.all, 'properties', params] as const,
  property: (id: string) => [...patrimonyKeys.all, 'property', id] as const,
  documents: (propertyId: string) => [...patrimonyKeys.all, 'documents', propertyId] as const,
  taxes: (params: Record<string, unknown>) => [...patrimonyKeys.all, 'taxes', params] as const,
  overview: () => [...patrimonyKeys.all, 'overview'] as const,
}

// ─── Taxes ────────────────────────────────────────────────────────────────────
// Rótulos de tipo/status vêm dos catálogos `patrimony.*`; aqui só a cor do chip.

export const TAX_STATUS_COLOR: Record<TaxStatus, 'default' | 'success' | 'error' | 'warning'> = {
  pending: 'default',
  paid: 'success',
  overdue: 'error',
  partial: 'warning',
}

// ─── Formatters ─────────────────────────────────────────────────────────────────

export function formatCents(v?: number | null): string {
  if (v == null) return '—'
  return (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(s?: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

export function formatArea(v?: number | null): string {
  if (v == null) return '—'
  return `${v.toLocaleString('pt-BR')} m²`
}

export function formatPct(v?: number | null): string {
  if (v == null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
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
