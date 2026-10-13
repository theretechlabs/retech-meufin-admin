import type { EntryStatus, IncomeType, Recurrence, SourceKind } from './api'

type Option<T extends string> = { value: T; label: string }

/** Tipo (kind) da fonte de receita. */
export const SOURCE_KIND_OPTIONS: Option<SourceKind>[] = [
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'freelance', label: 'Projeto avulso' },
  { value: 'rental', label: 'Aluguel' },
  { value: 'investment', label: 'Investimento' },
  { value: 'benefit', label: 'Benefício' },
  { value: 'other', label: 'Outro' },
]

export const SOURCE_KIND_LABEL: Record<SourceKind, string> = SOURCE_KIND_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<SourceKind, string>
)

/** Tipo da receita (natureza do lançamento). */
export const INCOME_TYPE_OPTIONS: Option<IncomeType>[] = [
  { value: 'salario', label: 'Salário (CLT)' },
  { value: 'pj_contrato', label: 'Remuneração PJ (contrato)' },
  { value: 'pro_labore', label: 'Pró-labore' },
  { value: 'dividendos', label: 'Dividendos' },
  { value: 'rendimento', label: 'Rendimentos (juros/investimentos)' },
  { value: 'aluguel', label: 'Aluguel' },
  { value: 'freela', label: 'Freela' },
  { value: 'ferias_13', label: '13º/Férias' },
  { value: 'beneficio', label: 'Benefício' },
  { value: 'reembolso', label: 'Reembolso' },
  { value: 'venda_bem', label: 'Venda de bem (veículo, imóvel)' },
  { value: 'outro', label: 'Outro' },
]

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

export const INCOME_TYPE_LABEL: Record<IncomeType, string> = INCOME_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<IncomeType, string>
)

/** Categoria da despesa (armazenada no campo `type` do lançamento). */
export const EXPENSE_CATEGORY_OPTIONS: Option<string>[] = [
  { value: 'moradia', label: 'Moradia' },
  { value: 'alimentacao', label: 'Alimentação' },
  { value: 'mercado', label: 'Mercado' },
  { value: 'saude', label: 'Saúde' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'educacao', label: 'Educação' },
  { value: 'lazer', label: 'Lazer' },
  { value: 'contas_fixas', label: 'Contas fixas' },
  { value: 'servicos', label: 'Serviços' },
  { value: 'impostos', label: 'Impostos' },
  { value: 'equipamentos', label: 'Equipamentos' },
  { value: 'outros', label: 'Outros' },
]

export const EXPENSE_CATEGORY_LABEL: Record<string, string> = EXPENSE_CATEGORY_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Bancos/instituições emissoras de cartão (campo `bank`). A bandeira
 * (Visa, Mastercard...) vem do catálogo global GET /finance/card-brands. */
export const CARD_BANK_OPTIONS: Option<string>[] = [
  { value: 'nubank', label: 'Nubank' },
  { value: 'inter', label: 'Inter' },
  { value: 'santander', label: 'Santander' },
  { value: 'itau', label: 'Itaú' },
  { value: 'bradesco', label: 'Bradesco' },
  { value: 'banco_do_brasil', label: 'Banco do Brasil' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'c6', label: 'C6' },
  { value: 'btg', label: 'BTG Pactual' },
  { value: 'xp', label: 'XP' },
  { value: 'mercado_pago', label: 'Mercado Pago' },
  { value: 'picpay', label: 'PicPay' },
  { value: 'neon', label: 'Neon' },
  { value: 'pan', label: 'Banco Pan' },
  { value: 'original', label: 'Original' },
  { value: 'safra', label: 'Safra' },
  { value: 'sicoob', label: 'Sicoob' },
  { value: 'sicredi', label: 'Sicredi' },
  { value: 'banrisul', label: 'Banrisul' },
  { value: 'bmg', label: 'BMG' },
  { value: 'bv', label: 'BV (Votorantim)' },
  { value: 'daycoval', label: 'Daycoval' },
  { value: 'pagbank', label: 'PagBank (PagSeguro)' },
  { value: 'will_bank', label: 'Will Bank' },
  { value: 'agibank', label: 'Agibank' },
  { value: 'digio', label: 'Digio' },
  { value: 'porto_bank', label: 'Porto Bank (Porto Seguro)' },
  { value: 'credicard', label: 'Credicard (Itaú)' },
  // Emissoras de cartão de varejo (private label / co-branded)
  { value: 'csf', label: 'Banco CSF (Carrefour/Atacadão)' },
  { value: 'bradescard', label: 'Bradescard (C&A e outros)' },
  { value: 'cetelem', label: 'Cetelem (BNP Paribas)' },
  { value: 'midway', label: 'Midway (Riachuelo)' },
  { value: 'realize', label: 'Realize (Renner)' },
  { value: 'pefisa', label: 'Pefisa (Pernambucanas)' },
  { value: 'luizacred', label: 'Luizacred (Magalu)' },
  { value: 'outro', label: 'Outro' },
]

export const CARD_BANK_LABEL: Record<string, string> = CARD_BANK_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Recorrência do lançamento. */
export const RECURRENCE_OPTIONS: Option<Recurrence>[] = [
  { value: 'none', label: 'Nenhuma' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
  { value: 'yearly', label: 'Anual' },
]

export const RECURRENCE_LABEL: Record<Recurrence, string> = RECURRENCE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<Recurrence, string>
)

/** Situação do lançamento. */
export const ENTRY_STATUS_OPTIONS: Option<EntryStatus>[] = [
  { value: 'prevista', label: 'Prevista' },
  { value: 'realizada', label: 'Realizada' },
  { value: 'cancelada', label: 'Cancelada' },
]

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = ENTRY_STATUS_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<EntryStatus, string>
)

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
  discountReasons: () => [...financeKeys.all, 'discount-reasons'] as const,
  lateCharges: (entryId: string, paidAt: string) =>
    [...financeKeys.all, 'late-charges', entryId, paidAt] as const,
  cancelReasons: () => [...financeKeys.all, 'cancel-reasons'] as const,
  renegotiations: () => [...financeKeys.all, 'renegotiations'] as const,
  debtLineage: (groupId: string) => [...financeKeys.all, 'debt-lineage', groupId] as const,
  renegotiationPreview: (groupId: string) =>
    [...financeKeys.all, 'renegotiation-preview', groupId] as const,
  assetDebts: (assetType: string, assetId: string) =>
    [...financeKeys.all, 'asset-debts', assetType, assetId] as const,
  cardBrands: () => [...financeKeys.all, 'card-brands'] as const,
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

/** Tipo da conta (finance_accounts). */
export const ACCOUNT_KIND_OPTIONS: Option<import('./api').AccountKind>[] = [
  { value: 'corrente', label: 'Conta corrente' },
  { value: 'poupanca', label: 'Poupança' },
  { value: 'carteira', label: 'Carteira / Dinheiro' },
  { value: 'digital', label: 'Conta digital' },
]

export const ACCOUNT_KIND_LABEL: Record<string, string> = ACCOUNT_KIND_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Forma de pagamento na liquidação. */
export const PAYMENT_METHOD_OPTIONS: Option<import('./api').PaymentMethod>[] = [
  { value: 'pix', label: 'Pix' },
  { value: 'debito', label: 'Débito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
]

export const ATTACHMENT_TYPE_OPTIONS: Option<import('./api').EntryAttachmentType>[] = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix_qrcode', label: 'QR Code Pix' },
  { value: 'nota_fiscal', label: 'Nota fiscal' },
  { value: 'contrato', label: 'Contrato' },
  { value: 'fatura', label: 'Fatura' },
  { value: 'outro', label: 'Outro' },
]

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

export const ATTACHMENT_TYPE_LABEL: Record<string, string> = ATTACHMENT_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  ...PAYMENT_METHOD_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>
  ),
  // Só o sistema grava (quitação/venda numa troca); não entra no select.
  compensacao: 'Compensação (sem caixa)',
}

/** Desfecho de um evento de dívida. */
export const RENEGOTIATION_KIND_LABEL: Record<import('./api').RenegotiationKind, string> = {
  renegociacao: 'Renegociação',
  quitacao: 'Quitação antecipada',
  troca_bem: 'Troca de bem',
}

/** Formas que apontam para uma conta (as demais: dinheiro=nada, cartao_credito=cartão). */
export const ACCOUNT_PAYMENT_METHODS = ['pix', 'debito', 'transferencia', 'boleto'] as const

/** Categoria do fornecedor. */
export const SUPPLIER_CATEGORY_OPTIONS: Option<import('./api').SupplierCategory>[] = [
  { value: 'servicos_publicos', label: 'Serviços Públicos' },
  { value: 'telecom', label: 'Telecom' },
  { value: 'streaming', label: 'Streaming' },
  { value: 'varejo', label: 'Varejo / E-commerce' },
  { value: 'farmacia', label: 'Farmácia' },
  { value: 'saude', label: 'Saúde' },
  { value: 'seguros', label: 'Seguros' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'educacao', label: 'Educação' },
  { value: 'alimentacao', label: 'Alimentação / Delivery' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'academia', label: 'Academia / Bem-estar' },
  { value: 'moradia', label: 'Moradia / Imóvel' },
  { value: 'tecnologia', label: 'Tecnologia / SaaS / TI' },
  { value: 'pet', label: 'Pet / Veterinário' },
  { value: 'juridico', label: 'Jurídico / Cartório' },
  { value: 'contabil', label: 'Contabilidade / Fiscal' },
  { value: 'condominio', label: 'Condomínio / IPTU' },
  { value: 'vestuario', label: 'Vestuário / Calçados' },
  { value: 'beleza', label: 'Beleza / Estética' },
  { value: 'viagem', label: 'Viagem / Hospedagem' },
  { value: 'entretenimento', label: 'Entretenimento / Eventos' },
  { value: 'outros', label: 'Outros' },
]

export const SUPPLIER_CATEGORY_LABEL: Record<string, string> = SUPPLIER_CATEGORY_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Tipo de cobrança padrão do fornecedor. */
export const SUPPLIER_BILLING_OPTIONS: Option<import('./api').SupplierBillingType>[] = [
  { value: 'boleto', label: 'Boleto' },
  { value: 'pix', label: 'Pix' },
  { value: 'cartao_credito', label: 'Cartão de crédito' },
  { value: 'debito_automatico', label: 'Débito automático' },
  { value: 'debito', label: 'Débito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'desconto_folha', label: 'Desconto em folha' },
]

export const SUPPLIER_BILLING_LABEL: Record<string, string> = SUPPLIER_BILLING_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

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
