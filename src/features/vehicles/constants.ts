import type {
  AlertStatus,
  FuelType,
  MaintenanceStatus,
  OSItemCategory,
  OSItemType,
  ScheduleAlertStatus,
  VehicleStatus,
} from './api'

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

export const FUEL_TYPE_OPTIONS: { value: FuelType; label: string }[] = [
  { value: 'flex', label: 'Flex' },
  { value: 'gasolina', label: 'Gasolina' },
  { value: 'etanol', label: 'Etanol' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'eletrico', label: 'Elétrico' },
  { value: 'hibrido', label: 'Híbrido' },
]

export const FUEL_TYPE_LABEL: Record<FuelType, string> = FUEL_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<FuelType, string>,
)

export const VEHICLE_STATUS_OPTIONS: { value: VehicleStatus; label: string }[] = [
  { value: 'active', label: 'Ativo' },
  { value: 'sold', label: 'Vendido' },
  { value: 'inactive', label: 'Inativo' },
]

export const VEHICLE_STATUS_LABEL: Record<VehicleStatus, string> = VEHICLE_STATUS_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<VehicleStatus, string>,
)

export const VEHICLE_STATUS_COLOR: Record<VehicleStatus, 'success' | 'default' | 'warning'> = {
  active: 'success',
  sold: 'warning',
  inactive: 'default',
}

export const FIPE_VEHICLE_TYPE_OPTIONS = [
  { value: 'carros', label: 'Carro' },
  { value: 'motos', label: 'Moto' },
  { value: 'caminhoes', label: 'Caminhão' },
]

export const FIPE_VEHICLE_TYPE_LABEL: Record<string, string> = {
  carros: 'Carro',
  motos: 'Moto',
  caminhoes: 'Caminhão',
}

export const ALERT_STATUS_COLOR: Record<AlertStatus, 'error' | 'warning' | 'success' | 'default'> = {
  overdue: 'error',
  due_soon: 'warning',
  ok: 'success',
  unknown: 'default',
}

export const ALERT_STATUS_LABEL: Record<AlertStatus, string> = {
  overdue: 'Vencido',
  due_soon: 'Próximo do vencimento',
  ok: 'Em dia',
  unknown: 'Sem histórico',
}

export const MAINTENANCE_TYPE_OPTIONS = [
  { value: 'Troca de óleo', label: 'Troca de óleo' },
  { value: 'Revisão preventiva', label: 'Revisão preventiva' },
  { value: 'Rodízio de pneus', label: 'Rodízio de pneus' },
  { value: 'Alinhamento e balanceamento', label: 'Alinhamento e balanceamento' },
  { value: 'Filtro de ar', label: 'Filtro de ar' },
  { value: 'Filtro de cabine', label: 'Filtro de cabine' },
  { value: 'Fluido de freio', label: 'Fluido de freio' },
  { value: 'Pastilhas de freio', label: 'Pastilhas de freio' },
  { value: 'Correia dentada', label: 'Correia dentada' },
  { value: 'Velas de ignição', label: 'Velas de ignição' },
  { value: 'Fluido de arrefecimento', label: 'Fluido de arrefecimento' },
  { value: 'Outro', label: 'Outro' },
]

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

export const OS_ITEM_CATEGORY_LABEL: Record<OSItemCategory, string> = {
  motor: 'Motor',
  freios: 'Freios',
  suspensao: 'Suspensão',
  transmissao: 'Transmissão',
  arrefecimento: 'Arrefecimento',
  eletrico: 'Elétrico',
  pneus: 'Pneus',
  ar_condicionado: 'Ar-condicionado',
  carroceria: 'Carroceria',
  servico: 'Serviço',
  outros: 'Outros',
}

export const OS_ITEM_CATEGORY_OPTIONS: { value: OSItemCategory; label: string }[] = Object.entries(
  OS_ITEM_CATEGORY_LABEL,
).map(([value, label]) => ({ value: value as OSItemCategory, label }))

export const OS_ITEM_TYPE_OPTIONS: { value: OSItemType; label: string }[] = [
  { value: 'product', label: 'Peça / Produto' },
  { value: 'service', label: 'Serviço' },
]

/** Janela da aba Análise (só UI): meses de histórico consultados. */
export const ANALYTICS_PERIOD_OPTIONS: { value: number; label: string }[] = [
  { value: 3, label: '3 meses' },
  { value: 6, label: '6 meses' },
  { value: 12, label: '12 meses' },
  { value: 24, label: '24 meses' },
]

export const SCHEDULE_ALERT_STATUS_LABEL: Record<ScheduleAlertStatus, string> = {
  pending: 'Pendente',
  due_soon: 'Próximo do vencimento',
  overdue: 'Vencido',
  done: 'Concluído',
  cancelled: 'Cancelado',
}

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

export const MAINTENANCE_STATUS_LABEL: Record<MaintenanceStatus, string> = {
  orcado: 'Orçado',
  agendado: 'Agendado',
  em_andamento: 'Em andamento',
  realizado: 'Realizado',
  cancelado: 'Cancelado',
}

export const MAINTENANCE_STATUS_COLOR: Record<MaintenanceStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  orcado: 'default',
  agendado: 'info',
  em_andamento: 'warning',
  realizado: 'success',
  cancelado: 'error',
}

export const MAINTENANCE_STATUS_OPTIONS = Object.entries(MAINTENANCE_STATUS_LABEL).map(
  ([value, label]) => ({ value: value as MaintenanceStatus, label })
)

/**
 * Forma de pagamento da ordem de serviço. NÃO é a mesma lista de
 * `@/features/finance/constants` (PAYMENT_METHOD_OPTIONS): os valores
 * divergem (`cartao_debito` aqui vs `debito` lá) e a API grava
 * `payment_method` da manutenção como texto livre, sem enum — unificar
 * exige migrar os registros existentes. Até lá, esta é a fonte do domínio
 * de veículos.
 */
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'transferencia', label: 'Transferência' },
]

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
