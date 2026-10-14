import type {
  AppointmentKind,
  AppointmentStatus,
  LabKind,
  PlanType,
  Relationship,
} from './api'

export const RELATIONSHIP_OPTIONS: { value: Relationship; label: string }[] = [
  { value: 'self', label: 'Eu' },
  { value: 'spouse', label: 'Cônjuge' },
  { value: 'child', label: 'Filho(a)' },
  { value: 'parent', label: 'Pai/Mãe' },
  { value: 'other', label: 'Outro' },
]

export const RELATIONSHIP_LABEL: Record<Relationship, string> = RELATIONSHIP_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<Relationship, string>
)

export const GENDER_OPTIONS: { value: string; label: string }[] = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Feminino' },
  { value: 'other', label: 'Outro' },
]

/**
 * Categorias do catálogo de exames. `value` = chave usada pelo backend (seed em PT),
 * `label` = rótulo em português exibido na UI. Campo continua livre no cadastro.
 */
export const MARKER_CATEGORIES: { value: string; label: string }[] = [
  { value: 'hematologia', label: 'Hematologia' },
  { value: 'bioquimica', label: 'Bioquímica' },
  { value: 'lipidico', label: 'Perfil lipídico' },
  { value: 'hepatico', label: 'Hepático' },
  { value: 'renal', label: 'Renal' },
  { value: 'eletrolitos', label: 'Eletrólitos' },
  { value: 'hormonios', label: 'Hormônios' },
  { value: 'vitaminas', label: 'Vitaminas' },
  { value: 'inflamacao', label: 'Inflamação' },
  { value: 'outros', label: 'Outros' },
]

/** Mapa chave -> rótulo PT para exibição (ex.: na tabela). */
export const MARKER_CATEGORY_LABEL: Record<string, string> = MARKER_CATEGORIES.reduce(
  (acc, c) => ({ ...acc, [c.value]: c.label }),
  {} as Record<string, string>,
)

export const EXAM_SOURCE_TYPES: { value: string; label: string }[] = [
  { value: 'manual', label: 'Manual' },
  { value: 'document', label: 'Documento' },
  { value: 'import', label: 'Importação' },
]

export const EXAM_RESULT_STATUS: { value: string; label: string }[] = [
  { value: 'draft', label: 'Rascunho' },
  { value: 'reviewed', label: 'Revisado' },
  { value: 'final', label: 'Finalizado' },
]

/** Tipos de local de saúde (health_labs.kind). */
export const LAB_KIND_OPTIONS: { value: LabKind; label: string }[] = [
  { value: 'laboratorio', label: 'Laboratório' },
  { value: 'clinica', label: 'Clínica' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'consultorio', label: 'Consultório' },
  { value: 'otica', label: 'Ótica' },
  { value: 'outros', label: 'Outros' },
]

export const LAB_KIND_LABEL: Record<string, string> = LAB_KIND_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Modalidades de plano de saúde. */
export const PLAN_TYPE_OPTIONS: { value: PlanType; label: string }[] = [
  { value: 'individual', label: 'Individual' },
  { value: 'familiar', label: 'Familiar' },
  { value: 'empresarial', label: 'Empresarial' },
  { value: 'odontologico', label: 'Odontológico' },
]

export const PLAN_TYPE_LABEL: Record<string, string> = PLAN_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Tipos de compromisso de saúde (health_appointments.kind). */
export const APPOINTMENT_KIND_OPTIONS: { value: AppointmentKind; label: string }[] = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'exame', label: 'Exame' },
  { value: 'retorno', label: 'Retorno' },
  { value: 'vacina', label: 'Vacina' },
  { value: 'procedimento', label: 'Procedimento' },
  { value: 'terapia', label: 'Terapia' },
  { value: 'odontologia', label: 'Odontologia' },
]

export const APPOINTMENT_KIND_LABEL: Record<string, string> = APPOINTMENT_KIND_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Especialidades médicas (campo opcional da consulta). */
export const SPECIALTY_OPTIONS: { value: string; label: string }[] = [
  { value: 'clinica_geral', label: 'Clínica geral' },
  { value: 'cardiologia', label: 'Cardiologia' },
  { value: 'pediatria', label: 'Pediatria' },
  { value: 'ginecologia', label: 'Ginecologia' },
  { value: 'dermatologia', label: 'Dermatologia' },
  { value: 'ortopedia', label: 'Ortopedia' },
  { value: 'oftalmologia', label: 'Oftalmologia' },
  { value: 'otorrino', label: 'Otorrinolaringologia' },
  { value: 'psicologia', label: 'Psicologia' },
  { value: 'psiquiatria', label: 'Psiquiatria' },
  { value: 'nutricao', label: 'Nutrição' },
  { value: 'endocrinologia', label: 'Endocrinologia' },
  { value: 'urologia', label: 'Urologia' },
  { value: 'geriatria', label: 'Geriatria' },
  { value: 'odontologia', label: 'Odontologia' },
  { value: 'fisioterapia', label: 'Fisioterapia' },
  { value: 'outros', label: 'Outros' },
]

export const SPECIALTY_LABEL: Record<string, string> = SPECIALTY_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

type ChipColor = 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'

/** Status de consulta com rótulo e cor do chip. */
export const APPOINTMENT_STATUS_META: Record<
  AppointmentStatus,
  { label: string; color: ChipColor }
> = {
  agendada: { label: 'Agendada', color: 'info' },
  confirmada: { label: 'Confirmada', color: 'primary' },
  realizada: { label: 'Realizada', color: 'success' },
  cancelada: { label: 'Cancelada', color: 'default' },
  faltou: { label: 'Faltou', color: 'error' },
}

export const APPOINTMENT_STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = (
  Object.keys(APPOINTMENT_STATUS_META) as AppointmentStatus[]
).map((value) => ({ value, label: APPOINTMENT_STATUS_META[value].label }))

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

/** Tipos de documento pessoal do membro. */
export const MEMBER_DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'cpf', label: 'CPF' },
  { value: 'rg', label: 'RG' },
  { value: 'cnh', label: 'CNH' },
  { value: 'passaporte', label: 'Passaporte' },
  { value: 'carteira_trabalho', label: 'Carteira de Trabalho' },
  { value: 'certidao_nascimento', label: 'Certidão de Nascimento' },
  { value: 'titulo_eleitor', label: 'Título de Eleitor' },
  { value: 'cartao_sus', label: 'Cartão SUS' },
  { value: 'plano_saude', label: 'Plano de Saúde' },
  { value: 'outro', label: 'Outro (informe o rótulo)' },
]

export const MEMBER_DOC_TYPE_LABEL: Record<string, string> = MEMBER_DOC_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

/** Tipos de documento do plano de saúde (contrato/apólice, carteirinha, boletos…). */
export const PLAN_DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'contrato', label: 'Contrato / Apólice' },
  { value: 'carteirinha', label: 'Carteirinha' },
  { value: 'manual', label: 'Manual do Beneficiário' },
  { value: 'tabela_coparticipacao', label: 'Tabela de Coparticipação' },
  { value: 'aditivo_reajuste', label: 'Aditivo / Reajuste' },
  { value: 'boleto', label: 'Boleto / Comprovante de Pagamento' },
  { value: 'termo_adesao', label: 'Termo de Adesão' },
  { value: 'comprovante_carencia', label: 'Comprovante de Carência' },
  { value: 'formulario_reembolso', label: 'Formulário de Reembolso' },
  { value: 'declaracao_ir', label: 'Declaração para IR' },
  { value: 'rede_credenciada', label: 'Rede Credenciada' },
  { value: 'laudo', label: 'Laudo / Relatório Médico' },
  { value: 'outro', label: 'Outro (informe o rótulo)' },
]

export const PLAN_DOC_TYPE_LABEL: Record<string, string> = PLAN_DOC_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)

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

/**
 * Tipos de documento de saúde (health_documents.document_type). Chaves VÁLIDAS
 * no backend (dom.ValidDocumentType) — chave fora da lista derruba o upload
 * com "document_type inválido".
 */
export const HEALTH_DOC_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'exam_result', label: 'Resultado de exame' },
  { value: 'exam_request', label: 'Solicitação' },
  { value: 'image_report', label: 'Exame de imagem' },
  { value: 'medical_report', label: 'Laudo médico' },
  { value: 'prescription', label: 'Receita' },
  { value: 'other', label: 'Outro' },
]

export const HEALTH_DOC_TYPE_LABEL: Record<string, string> = HEALTH_DOC_TYPE_OPTIONS.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<string, string>
)
