import type { AlertStatus, MaintenanceStatus, ScheduleAlertStatus, VehicleStatus } from './api'

export const vehicleKeys = {
  all: ['vehicles'] as const,
  list: (params: Record<string, unknown>) => [...vehicleKeys.all, 'list', params] as const,
  detail: (id: string) => [...vehicleKeys.all, 'detail', id] as const,
  maintenance: (vehicleId: string) => [...vehicleKeys.all, 'maintenance', vehicleId] as const,
  plans: (vehicleId: string) => [...vehicleKeys.all, 'plans', vehicleId] as const,
  alerts: (vehicleId: string) => [...vehicleKeys.all, 'alerts', vehicleId] as const,
  depreciation: (vehicleId: string) => [...vehicleKeys.all, 'depreciation', vehicleId] as const,
  fipeHistory: (vehicleId: string) => [...vehicleKeys.all, 'fipe-history', vehicleId] as const,
  fipeBrands: (type: string) => [...vehicleKeys.all, 'fipe', 'brands', type] as const,
  fipeModels: (type: string, brand: string) => [...vehicleKeys.all, 'fipe', 'models', type, brand] as const,
  fipeYears: (type: string, brand: string, model: string) =>
    [...vehicleKeys.all, 'fipe', 'years', type, brand, model] as const,
  fipePrice: (type: string, brand: string, model: string, year: string) =>
    [...vehicleKeys.all, 'fipe', 'price', type, brand, model, year] as const,
  catalog: (q: string, category: string) => [...vehicleKeys.all, 'catalog', q, category] as const,
  schedules: (vehicleId: string) => [...vehicleKeys.all, 'schedules', vehicleId] as const,
  analytics: (vehicleId: string, months: number) => [...vehicleKeys.all, 'analytics', vehicleId, months] as const,
}

// Rótulos dos enums vêm dos catálogos `vehicle.*`; aqui ficam só cores e listas de UI.

export const VEHICLE_STATUS_COLOR: Record<VehicleStatus, 'success' | 'default' | 'warning'> = {
  active: 'success',
  sold: 'warning',
  inactive: 'default',
}

export const ALERT_STATUS_COLOR: Record<AlertStatus, 'error' | 'warning' | 'success' | 'default'> = {
  overdue: 'error',
  due_soon: 'warning',
  ok: 'success',
  unknown: 'default',
}

export function formatMoney(v?: number | null): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatKM(v?: number | null): string {
  if (v == null) return '—'
  return `${v.toLocaleString('pt-BR')} km`
}

export function formatDate(s?: string | null): string {
  if (!s) return '—'
  const [y, m, d] = s.split('-')
  return `${d}/${m}/${y}`
}

export function parseFipeValue(s: string): number {
  return parseFloat(s.replace('R$ ', '').replace(/\./g, '').replace(',', '.')) || 0
}

export function vehicleLabel(v: { make: string; model: string; year_model: number }): string {
  return `${v.make} ${v.model} ${v.year_model}`
}

/** Janela da aba Análise (só UI): meses de histórico consultados. */
export const ANALYTICS_PERIOD_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
]

export const SCHEDULE_ALERT_STATUS_COLOR: Record<
  ScheduleAlertStatus,
  'error' | 'warning' | 'default' | 'success'
> = {
  pending: 'default',
  due_soon: 'warning',
  overdue: 'error',
  done: 'success',
  cancelled: 'default',
}

export const MAINTENANCE_STATUS_COLOR: Record<MaintenanceStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  orcado: 'default',
  agendado: 'info',
  em_andamento: 'warning',
  realizado: 'success',
  cancelado: 'error',
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
