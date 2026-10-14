import { meufinClient } from '@/lib/api/meufin-client'

/** Item de um catálogo de enum do domínio (rótulo vem da API, nunca do admin). */
export type CatalogItem = {
  slug: string
  name: string
  description?: string
}

/**
 * Chaves dos catálogos publicados por GET /api/v1/catalogs. Fonte única: a
 * API. Adicionar enum = adicionar aqui E no registro da API (o teste da API
 * garante que toda chave registrada tem itens válidos).
 */
export type CatalogKey =
  // finance
  | 'finance.income_source_kind'
  | 'finance.income_type'
  | 'finance.recurrence'
  | 'finance.entry_status'
  | 'finance.account_kind'
  | 'finance.payment_method'
  | 'finance.attachment_type'
  | 'finance.supplier_category'
  | 'finance.supplier_billing_type'
  | 'finance.renegotiation_kind'
  | 'finance.card_bank'
  | 'finance.bank_account_type'
  | 'finance.asset_type'
  | 'finance.discount_reason'
  | 'finance.cancel_reason'
  | 'finance.card_brand'
  // education
  | 'education.stage'
  | 'education.shift'
  | 'education.list_status'
  | 'education.item_category'
  // health
  | 'health.relationship'
  | 'health.gender'
  | 'health.lab_kind'
  | 'health.plan_type'
  | 'health.appointment_kind'
  | 'health.specialty'
  | 'health.appointment_status'
  | 'health.member_doc_type'
  | 'health.plan_doc_type'
  | 'health.document_type'
  | 'health.exam_source_type'
  | 'health.exam_result_status'
  | 'health.marker_category'
  // homesafety
  | 'homesafety.category'
  | 'homesafety.risk_type'
  | 'homesafety.priority'
  | 'homesafety.event_type'
  | 'homesafety.status'
  // patrimony
  | 'patrimony.property_type'
  | 'patrimony.property_doc_type'
  | 'patrimony.asset_type'
  | 'patrimony.tax_type'
  | 'patrimony.tax_status'
  // vehicle
  | 'vehicle.fuel_type'
  | 'vehicle.vehicle_status'
  | 'vehicle.fipe_vehicle_type'
  | 'vehicle.maintenance_type'
  | 'vehicle.maintenance_status'
  | 'vehicle.os_item_type'
  | 'vehicle.os_item_category'
  | 'vehicle.payment_method'
  | 'vehicle.alert_status'
  | 'vehicle.schedule_alert_status'
  // warranty
  | 'warranty.category'
  | 'warranty.status'
  | 'warranty.doc_type'

export type CatalogsResponse = {
  /** Hash do conteúdo; muda quando qualquer catálogo muda (também vai no ETag). */
  version: string
  catalogs: Partial<Record<CatalogKey, CatalogItem[]>>
}

/** Todos os catálogos de uma vez: uma chamada por sessão (cache infinito). */
export async function listCatalogs(): Promise<CatalogsResponse> {
  const { data } = await meufinClient.get<CatalogsResponse>('/api/v1/catalogs')
  return data
}
