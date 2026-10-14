import type { EntryStatus, IncomeType, Recurrence, SourceKind } from './api'

type Option<T extends string> = { value: T; label: string }

/**
 * Semântica de cada tipo de receita — é isto que deixa o sistema "raciocinar"
 * sobre a renda no futuro (composição ativa×passiva, sazonalidade na projeção,
 * inteligência fiscal). Regra: o catálogo de tipos é curado (nunca livre) para
 * a semântica não degradar; a liberdade de nomes fica na Fonte de Receita.
 *
 *  - nature: 'ativa' (você trabalhando) | 'passiva' (dinheiro trabalhando) |
 *    'neutra' (não é renda de verdade — ex.: reembolso é estorno e deve ficar
 *    FORA dos indicadores de composição de renda)
 *  - seasonal: true = não recorre todo mês (projeção anual não deve linearizar)
 *  - regime: dica do tratamento tributário típico no Brasil (uso futuro)
 */
export type IncomeNature = 'ativa' | 'passiva' | 'neutra'
export const INCOME_TYPE_SEMANTICS: Record<
  IncomeType,
  { nature: IncomeNature; seasonal: boolean; regime: string }
> = {
  salario: { nature: 'ativa', seasonal: false, regime: 'clt_fonte' },
  pj_contrato: { nature: 'ativa', seasonal: false, regime: 'pj_simples' },
  pro_labore: { nature: 'ativa', seasonal: false, regime: 'pro_labore_inss' },
  dividendos: { nature: 'passiva', seasonal: false, regime: 'isento' },
  rendimento: { nature: 'passiva', seasonal: false, regime: 'ir_investimento' },
  aluguel: { nature: 'passiva', seasonal: false, regime: 'carne_leao' },
  freela: { nature: 'ativa', seasonal: true, regime: 'variavel' },
  ferias_13: { nature: 'ativa', seasonal: true, regime: 'clt_fonte' },
  beneficio: { nature: 'passiva', seasonal: false, regime: 'isento' },
  reembolso: { nature: 'neutra', seasonal: true, regime: 'nao_tributavel' },
  venda_bem: { nature: 'neutra', seasonal: true, regime: 'ganho_capital' },
  outro: { nature: 'ativa', seasonal: false, regime: 'indefinido' },
}

/** Tipo sugerido a partir do kind da Fonte de Receita (menos um clique, menos erro na origem). */
export const SOURCE_KIND_TO_INCOME_TYPE: Partial<Record<SourceKind, IncomeType>> = {
  clt: 'salario',
  pj: 'pj_contrato',
  freelance: 'freela',
  rental: 'aluguel',
  investment: 'rendimento',
  benefit: 'beneficio',
}

/** Status que um lançamento importado (fatura, cupom) pode nascer. */
export const SETTLEABLE_STATUS_OPTIONS: Option<EntryStatus>[] = [
  { value: 'realizada', label: 'Realizada (já paga)' },
  { value: 'prevista', label: 'Prevista' },
]

/** Recorrência de fatura de cartão: só nenhuma ou mensal (até dezembro). */
export const INVOICE_RECURRENCE_OPTIONS: Option<Recurrence>[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'monthly', label: 'Mensal (até dezembro)' },
]

/** Origem de um parcelamento (filtro). */
export const INSTALLMENT_SOURCE_OPTIONS: Option<'invoice' | 'expense'>[] = [
  { value: 'invoice', label: 'Fatura de cartão' },
  { value: 'expense', label: 'Despesa parcelada' },
]

/** Filtro Ativas/Arquivadas (contas, fontes, categorias) e Ativos/Arquivados (cartões). */
export const ARCHIVED_FILTER_OPTIONS_F: Option<'true' | 'false'>[] = [
  { value: 'true', label: 'Ativas' },
  { value: 'false', label: 'Arquivadas' },
]
export const ARCHIVED_FILTER_OPTIONS_M: Option<'true' | 'false'>[] = [
  { value: 'true', label: 'Ativos' },
  { value: 'false', label: 'Arquivados' },
]

/** Cor do chip por status (MUI color). */
export const ENTRY_STATUS_COLOR: Record<EntryStatus, 'default' | 'warning' | 'success' | 'error'> =
  {
    prevista: 'warning',
    realizada: 'success',
    cancelada: 'error',
  }

export const MONTH_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
]

/** Lista de anos (ano atual +/- 2) para o filtro. */
export function yearOptions(base: number = new Date().getFullYear()): number[] {
  return [base - 2, base - 1, base, base + 1, base + 2]
}

/** react-query keys centralizados. */
export const financeKeys = {
  all: ['finance'] as const,
  incomeSources: () => [...financeKeys.all, 'income-sources'] as const,
  cards: () => [...financeKeys.all, 'cards'] as const,
  cardsIncludingInactive: () => [...financeKeys.all, 'cards', 'all'] as const,
  entries: (params: Record<string, unknown>) => [...financeKeys.all, 'entries', params] as const,
  entriesSummary: (params: Record<string, unknown>) =>
    [...financeKeys.all, 'entries-summary', params] as const,
  yearBounds: () => [...financeKeys.all, 'year-bounds'] as const,
  invoices: (params: Record<string, unknown>) => [...financeKeys.all, 'invoices', params] as const,
  familyMembers: () => [...financeKeys.all, 'family-members'] as const,
  accounts: () => [...financeKeys.all, 'accounts'] as const,
  expenseCategories: () => [...financeKeys.all, 'expense-categories'] as const,
  suppliers: () => [...financeKeys.all, 'suppliers'] as const,
  receipts: (entryId: string) => [...financeKeys.all, 'receipts', entryId] as const,
  attachments: (entryId: string) => [...financeKeys.all, 'attachments', entryId] as const,
  lateCharges: (entryId: string, paidAt: string) =>
    [...financeKeys.all, 'late-charges', entryId, paidAt] as const,
  cancelReasons: () => [...financeKeys.all, 'cancel-reasons'] as const,
  renegotiations: () => [...financeKeys.all, 'renegotiations'] as const,
  debtLineage: (groupId: string) => [...financeKeys.all, 'debt-lineage', groupId] as const,
  renegotiationPreview: (groupId: string) =>
    [...financeKeys.all, 'renegotiation-preview', groupId] as const,
  assetDebts: (assetType: string, assetId: string) =>
    [...financeKeys.all, 'asset-debts', assetType, assetId] as const,
  dashboard: (params: Record<string, unknown>) => [...financeKeys.all, 'dashboard', params] as const,
  dashboardCashflow: (params: Record<string, unknown>) =>
    [...financeKeys.all, 'dashboard-cashflow', params] as const,
  dashboardMonthly: (params: Record<string, unknown>) =>
    [...financeKeys.all, 'dashboard-monthly', params] as const,
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

/**
 * Tipos que fazem sentido em várias parcelas da mesma série (QR Pix da mesma
 * chave, contrato da série). Boleto, nota e fatura são de uma ocorrência só.
 */
export const ATTACHMENT_REPLICABLE: ReadonlySet<import('./api').EntryAttachmentType> = new Set([
  'pix_qrcode',
  'contrato',
])

export function isAttachmentReplicable(t: import('./api').EntryAttachmentType): boolean {
  return ATTACHMENT_REPLICABLE.has(t)
}

/** Formas que apontam para uma conta (as demais: dinheiro=nada, cartao_credito=cartão). */
export const ACCOUNT_PAYMENT_METHODS = ['pix', 'debito', 'transferencia', 'boleto'] as const

/** Formas que só o sistema grava (quitação/venda numa troca de bem); fora do select manual. */
export const SYSTEM_ONLY_PAYMENT_METHODS: ReadonlySet<string> = new Set(['compensacao'])

/**
 * Toast da edição em série: dia do vencimento alcança os lançamentos DESTA
 * edição em diante; valor/descrição/categoria só as previstas futuras.
 */
export function seriesToast(
  label: string,
  appliedToSeries: boolean,
  dueDatesUpdated: number,
  fieldsUpdated: number,
  newDueDay: number | null,
  isInstallment: boolean,
): string {
  if (!appliedToSeries) return `${label} atualizada com sucesso.`
  const unit = isInstallment ? 'parcela' : 'ocorrência'
  const parts: string[] = []
  if (dueDatesUpdated > 0) {
    const p = dueDatesUpdated > 1 ? 's' : ''
    parts.push(
      `vencimento movido para o dia ${newDueDay ?? '—'} em ${dueDatesUpdated} ${unit}${p} da série (desta em diante)`,
    )
  }
  if (fieldsUpdated > 0) {
    const p = fieldsUpdated > 1 ? 's' : ''
    parts.push(`demais alterações aplicadas a ${fieldsUpdated} ${unit}${p} prevista${p} futura${p}`)
  }
  if (parts.length === 0) {
    return `${label} atualizada — nenhum outro lançamento da série precisou mudar.`
  }
  return `${label} atualizada — ${parts.join('; ')}.`
}
