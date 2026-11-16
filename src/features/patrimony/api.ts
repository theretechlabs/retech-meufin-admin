import { meufinClient } from '@/lib/api/meufin-client'

const BASE = '/api/v1/patrimony'

// ─── Types ──────────────────────────────────────────────────────────────────────

export type PropertyType = 'casa' | 'apartamento' | 'terreno' | 'comercial' | 'rural' | 'outros'

export type Property = {
  id: string
  name: string
  property_type: PropertyType
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  registration_number?: string | null
  area_m2?: number | null
  purchase_date?: string | null
  purchase_value_cents?: number | null
  current_value_cents?: number | null
  notes?: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export type PropertyInput = {
  name: string
  property_type: string
  address?: string | null
  city?: string | null
  state?: string | null
  zip_code?: string | null
  registration_number?: string | null
  area_m2?: number | null
  purchase_date?: string | null
  purchase_value_cents?: number | null
  current_value_cents?: number | null
  notes?: string | null
  active?: boolean
}

/** O PUT substitui o imóvel inteiro: edição parcial parte do registro atual. */
export function propertyToInput(p: Property): PropertyInput {
  return {
    name: p.name,
    property_type: p.property_type,
    address: p.address ?? null,
    city: p.city ?? null,
    state: p.state ?? null,
    zip_code: p.zip_code ?? null,
    registration_number: p.registration_number ?? null,
    area_m2: p.area_m2 ?? null,
    purchase_date: p.purchase_date ?? null,
    purchase_value_cents: p.purchase_value_cents ?? null,
    current_value_cents: p.current_value_cents ?? null,
    notes: p.notes ?? null,
    active: p.active,
  }
}

export type PropertyDocType =
  | 'escritura' | 'matricula' | 'iptu' | 'contrato' | 'seguro' | 'planta' | 'outros'

export type PropertyDocument = {
  id: string
  property_id: string
  doc_type: PropertyDocType
  file_name: string
  content_type: string
  size_bytes: number
  notes?: string | null
  created_at: string
}

export type AssetType = 'property' | 'vehicle'

export type TaxType =
  | 'iptu' | 'ipva' | 'licenciamento' | 'dpvat' | 'condominio'
  | 'seguro_predial' | 'taxa_lixo' | 'taxa_bombeiros' | 'outros'

export type TaxStatus = 'pending' | 'paid' | 'overdue' | 'partial'

export type AssetTax = {
  id: string
  asset_type: AssetType
  property_id?: string | null
  vehicle_id?: string | null
  tax_type: TaxType
  reference_year: number
  description?: string | null
  due_date?: string | null
  amount_cents: number
  paid_cents: number
  paid_date?: string | null
  status: TaxStatus
  installments_total: number
  installment_number: number
  notes?: string | null
  created_at: string
  updated_at: string
}

export type AssetTaxInput = {
  asset_type: string
  property_id?: string | null
  vehicle_id?: string | null
  tax_type: string
  reference_year: number
  description?: string | null
  due_date?: string | null
  amount_cents: number
  paid_cents?: number
  paid_date?: string | null
  status?: string
  installments_total?: number
  installment_number?: number
  notes?: string | null
}

export type PayTaxInput = {
  paid_cents?: number
  paid_date?: string | null
}

export type TaxOverview = {
  total_properties: number
  total_property_value: number
  by_year: { year: number; planned_cents: number; paid_cents: number }[]
  by_tax_type_year: { tax_type: TaxType; year: number; planned_cents: number; paid_cents: number }[]
  inflation: {
    tax_type: TaxType
    year: number
    previous_year: number
    amount_cents: number
    previous_cents: number
    variation_pct?: number | null
  }[]
  upcoming: AssetTax[]
  overdue: AssetTax[]
}

export type Paginated<T> = { items: T[]; total: number }

// ─── Properties ─────────────────────────────────────────────────────────────────

export async function listProperties(params: {
  limit?: number
  offset?: number
  active?: boolean
}): Promise<Paginated<Property>> {
  const { data } = await meufinClient.get<Paginated<Property>>(`${BASE}/properties`, {
    params: { ...params, active: params.active ? 'true' : undefined },
  })
  return data
}

export async function getProperty(id: string): Promise<Property> {
  const { data } = await meufinClient.get<Property>(`${BASE}/properties/${id}`)
  return data
}

export async function createProperty(input: PropertyInput): Promise<Property> {
  const { data } = await meufinClient.post<Property>(`${BASE}/properties`, input)
  return data
}

export async function updateProperty(id: string, input: PropertyInput): Promise<Property> {
  const { data } = await meufinClient.put<Property>(`${BASE}/properties/${id}`, input)
  return data
}

export async function deleteProperty(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/properties/${id}`)
}

// ─── Property documents ───────────────────────────────────────────────────────

export async function listPropertyDocuments(propertyId: string): Promise<PropertyDocument[]> {
  const { data } = await meufinClient.get<{ items: PropertyDocument[] }>(
    `${BASE}/properties/${propertyId}/documents`,
  )
  return data.items ?? []
}

export async function uploadPropertyDocument(
  propertyId: string,
  input: { doc_type: string; notes?: string | null; file: File },
): Promise<PropertyDocument> {
  const form = new FormData()
  form.append('file', input.file)
  form.append('doc_type', input.doc_type)
  if (input.notes) form.append('notes', input.notes)
  const { data } = await meufinClient.post<PropertyDocument>(
    `${BASE}/properties/${propertyId}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  )
  return data
}

export async function propertyDocumentDownloadURL(propertyId: string, docId: string): Promise<string> {
  const { data } = await meufinClient.get<{ url: string }>(
    `${BASE}/properties/${propertyId}/documents/${docId}/download-url`,
  )
  return data.url
}

export async function deletePropertyDocument(propertyId: string, docId: string): Promise<void> {
  await meufinClient.delete(`${BASE}/properties/${propertyId}/documents/${docId}`)
}

// ─── Taxes ────────────────────────────────────────────────────────────────────

export async function listTaxes(params: {
  limit?: number
  offset?: number
  asset_type?: string
  tax_type?: string
  reference_year?: number
  status?: string
  property_id?: string
  vehicle_id?: string
}): Promise<Paginated<AssetTax>> {
  const { data } = await meufinClient.get<Paginated<AssetTax>>(`${BASE}/taxes`, { params })
  return data
}

export async function getTax(id: string): Promise<AssetTax> {
  const { data } = await meufinClient.get<AssetTax>(`${BASE}/taxes/${id}`)
  return data
}

export async function createTax(input: AssetTaxInput): Promise<AssetTax> {
  const { data } = await meufinClient.post<AssetTax>(`${BASE}/taxes`, input)
  return data
}

export async function updateTax(id: string, input: AssetTaxInput): Promise<AssetTax> {
  const { data } = await meufinClient.put<AssetTax>(`${BASE}/taxes/${id}`, input)
  return data
}

export async function deleteTax(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/taxes/${id}`)
}

export async function payTax(id: string, input: PayTaxInput): Promise<AssetTax> {
  const { data } = await meufinClient.post<AssetTax>(`${BASE}/taxes/${id}/pay`, input)
  return data
}

export async function getTaxOverview(): Promise<TaxOverview> {
  const { data } = await meufinClient.get<TaxOverview>(`${BASE}/taxes/overview`)
  return data
}
