import type { AppointmentStatus } from './api'

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'

/** Cor do chip por status de consulta (rótulo vem do catálogo `health.appointment_status`). */
export const APPOINTMENT_STATUS_COLOR: Record<AppointmentStatus, ChipColor> = {
  agendada: 'info',
  confirmada: 'primary',
  realizada: 'success',
  cancelada: 'default',
  faltou: 'error',
}

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

/** react-query keys centralizados. */
export const healthKeys = {
  all: ['health'] as const,
  dashboard: () => [...healthKeys.all, 'dashboard'] as const,
  evolution: (markerId: string, params: Record<string, unknown>) =>
    [...healthKeys.all, 'evolution', markerId, params] as const,
  familyMembers: () => [...healthKeys.all, 'family-members'] as const,
  birthdays: () => [...healthKeys.all, 'birthdays'] as const,
  labs: () => [...healthKeys.all, 'labs'] as const,
  markers: (params: Record<string, unknown>) => [...healthKeys.all, 'markers', params] as const,
  marker: (id: string) => [...healthKeys.all, 'marker', id] as const,
  examResults: () => [...healthKeys.all, 'exam-results'] as const,
  documents: () => [...healthKeys.all, 'documents'] as const,
  memberDocuments: (memberId: string) =>
    [...healthKeys.all, 'member-documents', memberId] as const,
  plans: () => [...healthKeys.all, 'plans'] as const,
  planDocuments: (planId: string) => [...healthKeys.all, 'plan-documents', planId] as const,
  appointments: () => [...healthKeys.all, 'appointments'] as const,
  agenda: () => [...healthKeys.all, 'agenda'] as const,
}

/** Extrai mensagem de erro amigável de erro axios/desconhecido. */
export function errorMessage(err: unknown, fallback = 'Ocorreu um erro. Tente novamente.'): string {
  if (typeof err === 'object' && err != null) {
    const anyErr = err as {
      response?: { data?: { error?: string | { message?: string }; message?: string } }
      message?: string
    }
    // A API responde { error: { code, message, request_id } } — objeto, não string.
    // Devolver o objeto quebraria o React ("Objects are not valid as a React child").
    const apiErr = anyErr.response?.data?.error
    if (typeof apiErr === 'string' && apiErr) return apiErr
    if (apiErr && typeof apiErr === 'object' && typeof apiErr.message === 'string' && apiErr.message) {
      return apiErr.message
    }
    return anyErr.response?.data?.message ?? anyErr.message ?? fallback
  }
  return fallback
}

/** Validade do link público de compartilhamento (horas). */
export const SHARE_TTL_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1 hora' },
  { value: 6, label: '6 horas' },
  { value: 12, label: '12 horas' },
  { value: 24, label: '24 horas' },
  { value: 48, label: '48 horas' },
  { value: 72, label: '3 dias' },
  { value: 168, label: '7 dias' },
]
