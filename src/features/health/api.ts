import { meufinClient } from '@/lib/api/meufin-client'

/**
 * API do módulo Saúde Familiar (retech-meufin-api).
 * Todos os endpoints sob VITE_API_BASE_URL + /api/v1/health.
 * O Bearer já é injetado pelo meufinClient; o workspace vem do token (sem header).
 */
const BASE = '/api/v1/health'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type Relationship = 'self' | 'spouse' | 'child' | 'parent' | 'other'

export type FamilyMember = {
  id: string
  full_name: string
  relationship: Relationship
  birth_date: string // "YYYY-MM-DD"
  gender?: string | null
  document?: string | null
  notes?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  age?: number | null // calculado pela API
  active: boolean
  avatar_url?: string | null // URL presignada (15min) da foto, quando houver
  created_at?: string
  updated_at?: string
}

export type FamilyMemberInput = {
  full_name: string
  relationship: Relationship
  birth_date: string
  gender?: string | null
  document?: string | null
  notes?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  active: boolean
}

/** Item do quadro de aniversariantes (GET /health/family-members/birthdays). */
export type Birthday = {
  id: string
  full_name: string
  relationship: Relationship
  birth_date: string // "YYYY-MM-DD"
  age: number // idade atual
  turns: number // idade que fará no próximo aniversário
  next_birthday: string // "YYYY-MM-DD"
  days_until: number // dias até o próximo aniversário (0 = hoje)
  avatar_url?: string | null // URL presignada (15min) da foto, quando houver
}

export type LabKind = 'laboratorio' | 'clinica' | 'hospital' | 'consultorio' | 'otica' | 'outros'

export type Lab = {
  id: string
  name: string
  kind: LabKind
  website_url?: string | null
  exam_results_url?: string | null
  contact_phone?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
  created_at?: string
  updated_at?: string
}

export type LabInput = {
  name: string
  kind: LabKind
  website_url?: string | null
  exam_results_url?: string | null
  contact_phone?: string | null
  address?: string | null
  notes?: string | null
  active: boolean
}

export type ComparabilityClass = string

export type MarkerAlias = { alias: string; normalized_alias: string }

/** Meta condicional de referência do catálogo (ex.: LDL por risco cardiovascular). */
export type RefTier = { label: string; min?: number | null; max?: number | null }

export type Marker = {
  id: string
  scope?: string
  canonical_name: string
  category: string
  comparability_class: ComparabilityClass
  canonical_unit?: string | null
  default_ref_tiers?: RefTier[] | null
  aliases?: MarkerAlias[]
  created_at?: string
  updated_at?: string
}

export type MarkerInput = {
  canonical_name: string
  category: string
  comparability_class: ComparabilityClass
  canonical_unit?: string | null
  aliases?: string[]
}

export type Paginated<T> = { items: T[]; total: number }

export type MarkerConflict = {
  error: string
  suggestion: Marker
}

export type MarkerResolveItem = {
  raw_name: string
  status: string
  matched?: Marker | null
  candidates?: Marker[]
}

// Exam Results
export type ExamSourceType = string
export type ExamStatus = string

export type ExamResultItem = {
  id?: string
  marker_id?: string | null
  raw_marker_name?: string | null
  result_value: string | number
  result_numeric?: number | null
  unit?: string | null
  reference_min?: number | null
  reference_max?: number | null
  reference_text?: string | null
  interpretation?: string | null
  interpretation_computed?: string | null
  method?: string | null
  material?: string | null
  raw_text?: string | null
  /** Curadoria do marcador, anexada pelo GET por id. */
  marker_name?: string | null
  marker_ref_min?: number | null
  marker_ref_max?: number | null
  marker_ref_text?: string | null
  marker_ref_tiers?: RefTier[] | null
}

export type ExamResult = {
  id: string
  family_member_id: string
  lab_id?: string | null
  exam_date: string
  source_type: ExamSourceType
  status: ExamStatus
  summary?: string | null
  notes?: string | null
  items: ExamResultItem[]
  created_at?: string
  updated_at?: string
}

export type ExamResultInput = {
  family_member_id: string
  lab_id?: string | null
  exam_date: string
  source_type: ExamSourceType
  status: ExamStatus
  summary?: string | null
  notes?: string | null
  items: ExamResultItem[]
}

// Exam Requests
export type ExamRequestItem = {
  id?: string
  marker_id?: string | null
  exam_name: string
  exam_code?: string | null
  body_area?: string | null
}

export type ExamRequest = {
  id: string
  family_member_id: string
  request_date: string
  lab_id?: string | null
  status: string
  notes?: string | null
  items: ExamRequestItem[]
  created_at?: string
  updated_at?: string
}

export type ExamRequestInput = {
  family_member_id: string
  request_date: string
  lab_id?: string | null
  status: string
  notes?: string | null
  items: ExamRequestItem[]
}

// Dashboard
export type HealthDashboard = {
  family_members: number
  exam_results: number
  tenant_markers: number
  documents_pending_review: number
}

export type EvolutionMode = 'absolute' | 'normalized'

export type EvolutionPoint = {
  exam_date: string
  value: number
  unit?: string | null
  reference_min?: number | null
  reference_max?: number | null
  reference_text?: string | null
  lab_id?: string | null
  interpretation?: string | null
  normalized?: number | null
}

/** Marcador com histórico dentro de um painel (GET /dashboard/panels). */
export type PanelMarker = {
  marker: {
    id: string
    canonical_name: string
    canonical_unit?: string | null
    comparability_class: ComparabilityClass
    category: string
  }
  default_mode: EvolutionMode
  points: EvolutionPoint[]
}

export type HealthPanel = {
  category: string
  markers: PanelMarker[]
  missing: { id: string; canonical_name: string; canonical_unit?: string | null; category: string }[]
}

export type MarkerEvolution = {
  marker: {
    id: string
    canonical_name: string
    canonical_unit?: string | null
    comparability_class: ComparabilityClass
  }
  default_mode: EvolutionMode
  points: EvolutionPoint[]
}

// ---------------------------------------------------------------------------
// Share links (link público temporário para o médico)
// ---------------------------------------------------------------------------

export type ShareLinkStatus = 'active' | 'expired' | 'revoked'

export type ShareLink = {
  id: string
  url: string
  scope: string
  family_member_id: string
  title?: string | null
  status: ShareLinkStatus
  expires_at: string
  view_count: number
  last_viewed_at?: string | null
  created_at: string
}

export type CreateShareLinkInput = {
  family_member_id: string
  title?: string
  expires_in_hours: number
}

export async function createShareLink(input: CreateShareLinkInput): Promise<ShareLink> {
  const { data } = await meufinClient.post<ShareLink>(`${BASE}/share-links`, input)
  return data
}

export async function listShareLinks(): Promise<ShareLink[]> {
  const { data } = await meufinClient.get<{ items: ShareLink[] }>(`${BASE}/share-links`)
  return data.items
}

export async function revokeShareLink(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/share-links/${id}`)
}

export type SharedPanelsResponse = {
  link: { title?: string | null; scope: string; member_name: string; expires_at: string }
  panels: { category: string; markers: PanelMarker[] }[]
}

/**
 * Acesso PÚBLICO (página do médico): sem Bearer — fetch direto, fora do
 * meufinClient, para não vazar token de sessão nem exigir login.
 */
export async function getSharedPanels(token: string): Promise<SharedPanelsResponse> {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001'
  const res = await fetch(`${base}/api/v1/public/health/${encodeURIComponent(token)}`)
  if (res.status === 410) throw new Error('LINK_EXPIRED')
  if (!res.ok) throw new Error(`shared_panels_${res.status}`)
  return (await res.json()) as SharedPanelsResponse
}

// Documents
export type HealthDocument = {
  id: string
  document_type: string
  family_member_id?: string | null
  lab_id?: string | null
  exam_request_id?: string | null
  exam_result_id?: string | null
  file_name?: string | null
  original_file_name?: string | null
  mime_type?: string | null
  size_bytes?: number | null
  extraction_status?: string | null
  created_at?: string
  updated_at?: string
}

export type ListDocumentsParams = {
  family_member_id?: string
  exam_result_id?: string
  document_type?: string
  limit?: number
  offset?: number
}

// ---------------------------------------------------------------------------
// Family Members
// ---------------------------------------------------------------------------

export async function listFamilyMembers(): Promise<FamilyMember[]> {
  const { data } = await meufinClient.get<Paginated<FamilyMember>>(`${BASE}/family-members`, {
    params: { limit: 500 },
  })
  return data.items
}

/** Variante paginada para a tela de gestão. */
export async function listFamilyMembersPaged(params: {
  limit: number
  offset: number
  query?: string
  relationship?: string
  active?: boolean
}): Promise<Paginated<FamilyMember>> {
  const { data } = await meufinClient.get<Paginated<FamilyMember>>(`${BASE}/family-members`, {
    params,
  })
  return data
}

export async function getFamilyMember(id: string): Promise<FamilyMember> {
  const { data } = await meufinClient.get<FamilyMember>(`${BASE}/family-members/${id}`)
  return data
}

export async function createFamilyMember(input: FamilyMemberInput): Promise<FamilyMember> {
  const { data } = await meufinClient.post<FamilyMember>(`${BASE}/family-members`, input)
  return data
}

export async function updateFamilyMember(id: string, input: FamilyMemberInput): Promise<FamilyMember> {
  const { data } = await meufinClient.put<FamilyMember>(`${BASE}/family-members/${id}`, input)
  return data
}

export async function deleteFamilyMember(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/family-members/${id}`)
}

/** Próximos aniversários dos membros ativos, ordenados por dias restantes. */
export async function fetchBirthdays(): Promise<Birthday[]> {
  const { data } = await meufinClient.get<{ items: Birthday[] }>(`${BASE}/family-members/birthdays`)
  return data.items ?? []
}

/** Envia a foto (avatar) do membro. O blob já vem recortado (JPEG 512×512). */
export async function uploadMemberAvatar(id: string, blob: Blob): Promise<FamilyMember> {
  const form = new FormData()
  form.append('file', blob, 'avatar.jpg')
  const { data } = await meufinClient.post<FamilyMember>(
    `${BASE}/family-members/${id}/avatar`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

/** Remove a foto (avatar) do membro. */
export async function deleteMemberAvatar(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/family-members/${id}/avatar`)
}

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------

export async function listLabs(): Promise<Lab[]> {
  const { data } = await meufinClient.get<Paginated<Lab>>(`${BASE}/labs`, {
    params: { limit: 500 },
  })
  return data.items
}

/** Variante paginada para a tela de gestão. */
export async function listLabsPaged(params: {
  limit: number
  offset: number
  query?: string
  active?: boolean
}): Promise<Paginated<Lab>> {
  const { data } = await meufinClient.get<Paginated<Lab>>(`${BASE}/labs`, { params })
  return data
}

export async function getLab(id: string): Promise<Lab> {
  const { data } = await meufinClient.get<Lab>(`${BASE}/labs/${id}`)
  return data
}

export async function createLab(input: LabInput): Promise<Lab> {
  const { data } = await meufinClient.post<Lab>(`${BASE}/labs`, input)
  return data
}

export async function updateLab(id: string, input: LabInput): Promise<Lab> {
  const { data } = await meufinClient.put<Lab>(`${BASE}/labs/${id}`, input)
  return data
}

export async function deleteLab(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/labs/${id}`)
}

// ---------------------------------------------------------------------------
// Markers (catálogo de exames)
// ---------------------------------------------------------------------------

export type ListMarkersParams = {
  query?: string
  category?: string
  limit?: number
  offset?: number
}

export async function listMarkers(
  params: ListMarkersParams = {},
  signal?: AbortSignal,
): Promise<Paginated<Marker>> {
  const { data } = await meufinClient.get<Paginated<Marker>>(`${BASE}/markers`, { params, signal })
  return data
}

export async function getMarker(id: string): Promise<Marker> {
  const { data } = await meufinClient.get<Marker>(`${BASE}/markers/${id}`)
  return data
}

/**
 * Cria um marcador do tenant. Em duplicata a API responde 409 com
 * { error, suggestion }. O erro é propagado (axios) para o chamador tratar.
 */
export async function createMarker(input: MarkerInput): Promise<Marker> {
  const { data } = await meufinClient.post<Marker>(`${BASE}/markers`, input)
  return data
}

export async function updateMarker(id: string, input: MarkerInput): Promise<Marker> {
  const { data } = await meufinClient.put<Marker>(`${BASE}/markers/${id}`, input)
  return data
}

export async function deleteMarker(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/markers/${id}`)
}

export async function resolveMarkers(rawNames: string[]): Promise<MarkerResolveItem[]> {
  const { data } = await meufinClient.post<{ items: MarkerResolveItem[] }>(`${BASE}/markers/resolve`, {
    items: rawNames.map((raw_name) => ({ raw_name })),
  })
  return data.items
}

// ---------------------------------------------------------------------------
// Exam Results
// ---------------------------------------------------------------------------

export async function listExamResults(): Promise<ExamResult[]> {
  const { data } = await meufinClient.get<Paginated<ExamResult>>(`${BASE}/exam-results`, {
    params: { limit: 500 },
  })
  return data.items
}

/** Variante paginada para a tela de gestão. */
export async function listExamResultsPaged(params: {
  limit: number
  offset: number
  query?: string
  family_member_id?: string
  status?: string
}): Promise<Paginated<ExamResult>> {
  const { data } = await meufinClient.get<Paginated<ExamResult>>(`${BASE}/exam-results`, {
    params,
  })
  return data
}

export async function getExamResult(id: string): Promise<ExamResult> {
  const { data } = await meufinClient.get<ExamResult>(`${BASE}/exam-results/${id}`)
  return data
}

export async function createExamResult(input: ExamResultInput): Promise<ExamResult> {
  const { data } = await meufinClient.post<ExamResult>(`${BASE}/exam-results`, input)
  return data
}

export async function updateExamResult(
  id: string,
  input: Partial<ExamResultInput>
): Promise<ExamResult> {
  const { data } = await meufinClient.put<ExamResult>(`${BASE}/exam-results/${id}`, input)
  return data
}

export async function deleteExamResult(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/exam-results/${id}`)
}

export async function addExamResultItem(
  resultId: string,
  item: ExamResultItem
): Promise<ExamResultItem> {
  const { data } = await meufinClient.post<ExamResultItem>(
    `${BASE}/exam-results/${resultId}/items`,
    item
  )
  return data
}

export async function updateExamResultItem(
  resultId: string,
  itemId: string,
  item: ExamResultItem
): Promise<ExamResultItem> {
  const { data } = await meufinClient.put<ExamResultItem>(
    `${BASE}/exam-results/${resultId}/items/${itemId}`,
    item
  )
  return data
}

export async function deleteExamResultItem(resultId: string, itemId: string): Promise<void> {
  await meufinClient.delete(`${BASE}/exam-results/${resultId}/items/${itemId}`)
}

// ---------------------------------------------------------------------------
// Exam Requests
// ---------------------------------------------------------------------------

export async function listExamRequests(): Promise<ExamRequest[]> {
  const { data } = await meufinClient.get<Paginated<ExamRequest>>(`${BASE}/exam-requests`)
  return data.items
}

export async function getExamRequest(id: string): Promise<ExamRequest> {
  const { data } = await meufinClient.get<ExamRequest>(`${BASE}/exam-requests/${id}`)
  return data
}

export async function createExamRequest(input: ExamRequestInput): Promise<ExamRequest> {
  const { data } = await meufinClient.post<ExamRequest>(`${BASE}/exam-requests`, input)
  return data
}

export async function updateExamRequest(
  id: string,
  input: Partial<ExamRequestInput>
): Promise<ExamRequest> {
  const { data } = await meufinClient.put<ExamRequest>(`${BASE}/exam-requests/${id}`, input)
  return data
}

export async function deleteExamRequest(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/exam-requests/${id}`)
}

// ---------------------------------------------------------------------------
// Planos de saúde
// ---------------------------------------------------------------------------

export type PlanType = 'individual' | 'familiar' | 'empresarial' | 'odontologico'

export type PlanMember = {
  id: string
  plan_id: string
  member_id: string
  card_number?: string | null
  holder: boolean
  created_at?: string
}

export type HealthPlan = {
  id: string
  name: string
  operator?: string | null
  plan_type: PlanType
  ans_code?: string | null
  monthly_fee_cents: number
  coverage_notes?: string | null
  active: boolean
  members: PlanMember[]
  created_at?: string
  updated_at?: string
}

export type PlanMemberInput = {
  member_id: string
  card_number?: string | null
  holder: boolean
}

export type HealthPlanInput = {
  name: string
  operator?: string | null
  plan_type: PlanType
  ans_code?: string | null
  monthly_fee_cents: number
  coverage_notes?: string | null
  active: boolean
  members?: PlanMemberInput[]
}

export async function listHealthPlans(): Promise<HealthPlan[]> {
  const { data } = await meufinClient.get<Paginated<HealthPlan>>(`${BASE}/plans`, {
    params: { limit: 500 },
  })
  return data.items
}

export async function getHealthPlan(id: string): Promise<HealthPlan> {
  const { data } = await meufinClient.get<HealthPlan>(`${BASE}/plans/${id}`)
  return data
}

export async function createHealthPlan(input: HealthPlanInput): Promise<HealthPlan> {
  const { data } = await meufinClient.post<HealthPlan>(`${BASE}/plans`, input)
  return data
}

export async function updateHealthPlan(
  id: string,
  input: HealthPlanInput
): Promise<HealthPlan> {
  const { data } = await meufinClient.put<HealthPlan>(`${BASE}/plans/${id}`, input)
  return data
}

export async function deleteHealthPlan(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/plans/${id}`)
}

/** Substitui integralmente os membros vinculados a um plano. */
export async function replacePlanMembers(
  id: string,
  members: PlanMemberInput[]
): Promise<HealthPlan> {
  const { data } = await meufinClient.put<HealthPlan>(`${BASE}/plans/${id}/members`, { members })
  return data
}

// ---------------------------------------------------------------------------
// Consultas & Agenda
// ---------------------------------------------------------------------------

export type AppointmentKind =
  | 'consulta'
  | 'exame'
  | 'retorno'
  | 'vacina'
  | 'procedimento'
  | 'terapia'
  | 'odontologia'

export type AppointmentStatus = 'agendada' | 'confirmada' | 'realizada' | 'cancelada' | 'faltou'

export type Appointment = {
  id: string
  family_member_id: string
  member_name?: string
  kind: AppointmentKind
  specialty?: string | null
  professional_name?: string | null
  lab_id?: string | null
  lab_name?: string | null
  exam_request_id?: string | null
  plan_id?: string | null
  plan_name?: string | null
  scheduled_at: string // ISO 8601
  status: AppointmentStatus
  reason?: string | null
  outcome?: string | null
  price_cents: number
  covered_by_plan: boolean
  notes?: string | null
  created_at?: string
  updated_at?: string
}

export type AppointmentInput = {
  family_member_id: string
  kind: AppointmentKind
  specialty?: string | null
  professional_name?: string | null
  lab_id?: string | null
  exam_request_id?: string | null
  plan_id?: string | null
  scheduled_at: string // ISO 8601
  status?: AppointmentStatus
  reason?: string | null
  price_cents?: number
  covered_by_plan?: boolean
  notes?: string | null
}

export type AppointmentFilters = {
  family_member_id?: string
  status?: AppointmentStatus | ''
  kind?: AppointmentKind | ''
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
  lab_id?: string
  plan_id?: string
  limit?: number
  offset?: number
}

export async function listAppointments(
  filters: AppointmentFilters = {}
): Promise<Paginated<Appointment>> {
  const params: Record<string, unknown> = { limit: filters.limit ?? 500, offset: filters.offset ?? 0 }
  if (filters.family_member_id) params.family_member_id = filters.family_member_id
  if (filters.status) params.status = filters.status
  if (filters.kind) params.kind = filters.kind
  if (filters.from) params.from = filters.from
  if (filters.to) params.to = filters.to
  if (filters.lab_id) params.lab_id = filters.lab_id
  if (filters.plan_id) params.plan_id = filters.plan_id
  const { data } = await meufinClient.get<Paginated<Appointment>>(`${BASE}/appointments`, { params })
  return data
}

export async function getAppointment(id: string): Promise<Appointment> {
  const { data } = await meufinClient.get<Appointment>(`${BASE}/appointments/${id}`)
  return data
}

export async function createAppointment(input: AppointmentInput): Promise<Appointment> {
  const { data } = await meufinClient.post<Appointment>(`${BASE}/appointments`, input)
  return data
}

export async function updateAppointment(
  id: string,
  input: AppointmentInput
): Promise<Appointment> {
  const { data } = await meufinClient.put<Appointment>(`${BASE}/appointments/${id}`, input)
  return data
}

export async function deleteAppointment(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/appointments/${id}`)
}

export async function confirmAppointment(id: string): Promise<Appointment> {
  const { data } = await meufinClient.post<Appointment>(`${BASE}/appointments/${id}/confirm`)
  return data
}

export async function cancelAppointment(id: string): Promise<Appointment> {
  const { data } = await meufinClient.post<Appointment>(`${BASE}/appointments/${id}/cancel`)
  return data
}

export async function noShowAppointment(id: string): Promise<Appointment> {
  const { data } = await meufinClient.post<Appointment>(`${BASE}/appointments/${id}/no-show`)
  return data
}

export async function completeAppointment(
  id: string,
  body: { outcome?: string | null; price_cents?: number | null }
): Promise<Appointment> {
  const { data } = await meufinClient.post<Appointment>(`${BASE}/appointments/${id}/complete`, body)
  return data
}

export type AgendaStatusCount = { status: AppointmentStatus; count: number }
export type AgendaSpecialtyCount = { specialty: string; count: number }
export type AgendaMemberCount = { member_id: string; member_name: string; count: number }

export type HealthAgenda = {
  year: number
  upcoming: Appointment[]
  next_7_count: number
  next_30_count: number
  status_counts: AgendaStatusCount[]
  year_spend_cents: number
  plans_monthly_fee_cents: number
  plans_annual_fee_cents: number
  by_specialty: AgendaSpecialtyCount[]
  by_member: AgendaMemberCount[]
}

export async function getHealthAgenda(): Promise<HealthAgenda> {
  const { data } = await meufinClient.get<HealthAgenda>(`${BASE}/appointments/agenda`)
  return data
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getHealthDashboard(): Promise<HealthDashboard> {
  const { data } = await meufinClient.get<HealthDashboard>(`${BASE}/dashboard`)
  return data
}

export type MarkerEvolutionParams = {
  family_member_id?: string
  from?: string
  to?: string
}

export async function getDashboardPanels(params: { family_member_id?: string } = {}): Promise<{
  panels: HealthPanel[]
}> {
  const { data } = await meufinClient.get<{ panels: HealthPanel[] }>(`${BASE}/dashboard/panels`, {
    params,
  })
  return data
}

export async function getMarkerEvolution(
  markerId: string,
  params: MarkerEvolutionParams = {}
): Promise<MarkerEvolution> {
  const { data } = await meufinClient.get<MarkerEvolution>(
    `${BASE}/dashboard/markers/${markerId}/evolution`,
    { params }
  )
  return data
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function listDocumentsPaged(params: ListDocumentsParams = {}): Promise<Paginated<HealthDocument>> {
  const { data } = await meufinClient.get<Paginated<HealthDocument>>(`${BASE}/documents`, { params })
  return data
}

/** Vincula (examResultId) ou desvincula (null) o documento a um resultado. */
export async function linkDocument(id: string, examResultId: string | null): Promise<HealthDocument> {
  const { data } = await meufinClient.patch<HealthDocument>(`${BASE}/documents/${id}`, {
    exam_result_id: examResultId,
  })
  return data
}

export async function deleteDocument(id: string): Promise<void> {
  await meufinClient.delete(`${BASE}/documents/${id}`)
}

export async function listDocuments(): Promise<HealthDocument[]> {
  const { data } = await meufinClient.get<Paginated<HealthDocument>>(`${BASE}/documents`)
  return data.items
}

export async function uploadDocument(form: FormData): Promise<HealthDocument> {
  const { data } = await meufinClient.post<HealthDocument>(`${BASE}/documents`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function getDocumentDownloadUrl(id: string): Promise<{ url: string }> {
  const { data } = await meufinClient.get<{ url: string }>(`${BASE}/documents/${id}/download-url`)
  return data
}

export async function extractDocument(id: string, pdfPassword?: string): Promise<unknown> {
  const body = pdfPassword ? { pdf_password: pdfPassword } : undefined
  const { data } = await meufinClient.post(`${BASE}/documents/${id}/extract`, body)
  return data
}

// ---------------------------------------------------------------------------
// Importação de exame (extração LLM → sugestões → confirmação)
// ---------------------------------------------------------------------------

export type MarkerCandidateSuggestion = {
  marker_id: string
  canonical_name: string
  canonical_unit?: string | null
  similarity: number
}

export type ExamItemSuggestion = {
  raw_name: string
  result_value: string
  result_numeric?: number | null
  unit?: string | null
  reference_min?: number | null
  reference_max?: number | null
  reference_text?: string | null
  material?: string | null
  method?: string | null
  interpretation?: string | null
  raw_text?: string | null
  marker_status: 'matched' | 'ambiguous' | 'unresolved'
  marker_id?: string | null
  marker_name?: string | null
  candidates?: MarkerCandidateSuggestion[]
  marker_is_new?: boolean
  /** Curadoria do marcador casado: texto e metas condicionais (ex.: LDL por risco). */
  marker_ref_text?: string | null
  marker_ref_tiers?: RefTier[] | null
}

export type ExamSuggestion = {
  patient_name?: string
  exam_date?: string
  collection_date?: string
  release_date?: string
  laboratory_name?: string
  doctor_name?: string
  summary?: string
  warnings?: string[]
  items: ExamItemSuggestion[]
  lab_id?: string | null
  lab_is_new?: boolean
}

export type HealthExtractionStatus = {
  id: string
  document_id: string
  provider: string
  model?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  input_type: string
  error_message?: string
  started_at?: string
  finished_at?: string
  created_at: string
  updated_at: string
  exam?: ExamSuggestion
}

export async function getDocumentExtractionStatus(id: string): Promise<HealthExtractionStatus> {
  const { data } = await meufinClient.get<HealthExtractionStatus>(
    `${BASE}/documents/${id}/extraction-status`
  )
  return data
}

export type ConfirmExamNewMarker = {
  name: string
  category?: string
  canonical_unit?: string | null
  ref_min?: number | null
  ref_max?: number | null
  ref_text?: string | null
  aliases?: string[]
}

export type ConfirmExamItem = {
  marker_id?: string | null
  new_marker?: ConfirmExamNewMarker | null
  raw_marker_name?: string | null
  result_value: string
  result_numeric?: number | null
  unit?: string | null
  reference_min?: number | null
  reference_max?: number | null
  reference_text?: string | null
  method?: string | null
  material?: string | null
  raw_text?: string | null
}

export type ConfirmExamPayload = {
  family_member_id: string
  exam_date: string
  collection_date?: string | null
  release_date?: string | null
  lab_id?: string | null
  new_lab_name?: string | null
  summary?: string | null
  notes?: string | null
  items: ConfirmExamItem[]
}

export type ConfirmExamResponse = {
  exam_result_id: string
  document_id: string
  items_total: number
  created_markers: { id: string; canonical_name: string; category: string }[]
  created_lab?: { id: string; name: string }
}

export async function confirmExamDocument(
  id: string,
  payload: ConfirmExamPayload
): Promise<ConfirmExamResponse> {
  const { data } = await meufinClient.post<ConfirmExamResponse>(
    `${BASE}/documents/${id}/confirm`,
    payload
  )
  return data
}

// ---------------------------------------------------------------------------
// Documentos pessoais do membro (cpf, rg, cnh, ...)
// ---------------------------------------------------------------------------

export type MemberDocType =
  | 'cpf'
  | 'rg'
  | 'cnh'
  | 'passaporte'
  | 'carteira_trabalho'
  | 'certidao_nascimento'
  | 'titulo_eleitor'
  | 'cartao_sus'
  | 'plano_saude'
  | 'outro'

export type MemberDocument = {
  id: string
  family_member_id: string
  doc_type: MemberDocType
  label?: string | null
  doc_number?: string | null
  valid_until?: string | null // "YYYY-MM-DD"
  notes?: string | null
  file_name: string
  original_file_name: string
  mime_type: string
  size_bytes: number
  created_at?: string
  updated_at?: string
}

export type MemberDocumentInput = {
  doc_type: MemberDocType
  label?: string | null
  doc_number?: string | null
  valid_until?: string | null
  notes?: string | null
  file: File
}

export async function listMemberDocuments(memberId: string): Promise<MemberDocument[]> {
  const { data } = await meufinClient.get<Paginated<MemberDocument>>(
    `${BASE}/family-members/${memberId}/documents`
  )
  return data.items ?? []
}

/** Upload multipart: file + doc_type (+ label, doc_number, valid_until, notes). */
export async function uploadMemberDocument(
  memberId: string,
  input: MemberDocumentInput
): Promise<MemberDocument> {
  const form = new FormData()
  form.append('file', input.file)
  form.append('doc_type', input.doc_type)
  if (input.label) form.append('label', input.label)
  if (input.doc_number) form.append('doc_number', input.doc_number)
  if (input.valid_until) form.append('valid_until', input.valid_until)
  if (input.notes) form.append('notes', input.notes)
  const { data } = await meufinClient.post<MemberDocument>(
    `${BASE}/family-members/${memberId}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

export async function memberDocumentDownloadURL(memberId: string, docId: string): Promise<string> {
  const { data } = await meufinClient.get<{ url: string }>(
    `${BASE}/family-members/${memberId}/documents/${docId}/download-url`
  )
  return data.url
}

export async function deleteMemberDocument(memberId: string, docId: string): Promise<void> {
  await meufinClient.delete(`${BASE}/family-members/${memberId}/documents/${docId}`)
}

// ---------------------------------------------------------------------------
// Documentos do plano de saúde (contrato/apólice, carteirinha, boletos…)
// ---------------------------------------------------------------------------

export type PlanDocType =
  | 'contrato'
  | 'carteirinha'
  | 'manual'
  | 'tabela_coparticipacao'
  | 'aditivo_reajuste'
  | 'boleto'
  | 'termo_adesao'
  | 'comprovante_carencia'
  | 'formulario_reembolso'
  | 'declaracao_ir'
  | 'rede_credenciada'
  | 'laudo'
  | 'outro'

export type PlanDocument = {
  id: string
  plan_id: string
  doc_type: PlanDocType
  label?: string | null
  doc_number?: string | null
  valid_until?: string | null // "YYYY-MM-DD"
  notes?: string | null
  file_name: string
  original_file_name: string
  mime_type: string
  size_bytes: number
  created_at?: string
  updated_at?: string
}

export type PlanDocumentInput = {
  doc_type: PlanDocType
  label?: string | null
  doc_number?: string | null
  valid_until?: string | null
  notes?: string | null
  file: File
}

export async function listPlanDocuments(planId: string): Promise<PlanDocument[]> {
  const { data } = await meufinClient.get<Paginated<PlanDocument>>(
    `${BASE}/plans/${planId}/documents`
  )
  return data.items ?? []
}

/** Upload multipart: file + doc_type (+ label, doc_number, valid_until, notes). */
export async function uploadPlanDocument(
  planId: string,
  input: PlanDocumentInput
): Promise<PlanDocument> {
  const form = new FormData()
  form.append('file', input.file)
  form.append('doc_type', input.doc_type)
  if (input.label) form.append('label', input.label)
  if (input.doc_number) form.append('doc_number', input.doc_number)
  if (input.valid_until) form.append('valid_until', input.valid_until)
  if (input.notes) form.append('notes', input.notes)
  const { data } = await meufinClient.post<PlanDocument>(
    `${BASE}/plans/${planId}/documents`,
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return data
}

export async function planDocumentDownloadURL(planId: string, docId: string): Promise<string> {
  const { data } = await meufinClient.get<{ url: string }>(
    `${BASE}/plans/${planId}/documents/${docId}/download-url`
  )
  return data.url
}

export async function deletePlanDocument(planId: string, docId: string): Promise<void> {
  await meufinClient.delete(`${BASE}/plans/${planId}/documents/${docId}`)
}
