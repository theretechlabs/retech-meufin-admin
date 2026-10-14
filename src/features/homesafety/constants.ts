import type { HomeSafetyCategory, HomeSafetyPriority, HomeSafetyStatus } from './api'

export const homeSafetyKeys = {
  all: ['home-safety'] as const,
  dashboard: () => [...homeSafetyKeys.all, 'dashboard'] as const,
  items: (params: Record<string, unknown>) => [...homeSafetyKeys.all, 'items', params] as const,
  item: (id: string) => [...homeSafetyKeys.all, 'item', id] as const,
  events: (itemId: string) => [...homeSafetyKeys.all, 'events', itemId] as const,
  catalog: () => [...homeSafetyKeys.all, 'catalog'] as const,
}

// ─── Categoria ────────────────────────────────────────────────────────────────
// Rótulos vêm do catálogo `homesafety.category`; aqui só as cores dos gráficos.

export const CATEGORY_COLOR: Record<HomeSafetyCategory, string> = {
  gas: '#e65100',
  agua: '#0277bd',
  incendio: '#c62828',
  eletrica: '#f9a825',
  climatizacao: '#00838f',
  pragas: '#6a1b9a',
  estrutura: '#4e342e',
  seguranca_eletronica: '#283593',
  piscina: '#0097a7',
  saude: '#2e7d32',
  outros: '#616161',
}

// ─── Prioridade ───────────────────────────────────────────────────────────────

export const PRIORITY_COLOR: Record<HomeSafetyPriority, 'error' | 'warning' | 'default'> = {
  alta: 'error',
  media: 'warning',
  baixa: 'default',
}

// ─── Status ───────────────────────────────────────────────────────────────────

export const STATUS_COLOR: Record<HomeSafetyStatus, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  vencido: 'error',
  atencao: 'warning',
  proximo: 'info',
  ok: 'success',
  sem_controle: 'default',
}

// Cor hex para gráficos e destaques por status.
export const STATUS_HEX: Record<HomeSafetyStatus, string> = {
  vencido: '#c62828',
  atencao: '#ed6c02',
  proximo: '#0288d1',
  ok: '#2e7d32',
  sem_controle: '#9e9e9e',
}

// ─── Formatadores ─────────────────────────────────────────────────────────────

export function formatCents(cents?: number | null): string {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatDate(s?: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function formatMonths(n?: number | null): string {
  if (n == null) return '—'
  if (n % 12 === 0) {
    const years = n / 12
    return years === 1 ? '1 ano' : `${years} anos`
  }
  return n === 1 ? '1 mês' : `${n} meses`
}

export function formatDaysUntil(days?: number | null): string {
  if (days == null) return 'Sem controle'
  if (days < 0) return `Vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}`
  if (days === 0) return 'Vence hoje'
  return `Faltam ${days} dia${days === 1 ? '' : 's'}`
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
