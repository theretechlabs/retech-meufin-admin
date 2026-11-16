import { formatDecimalBR, parseDecimalBR } from '@/components/fields/DecimalField'
import { formatCents, reaisToCents } from './api'
import { addMonthsClamped } from './installments'

/** Casas decimais das taxas de contrato, como os bancos publicam (4,5939%). */
export const RATE_DECIMALS = 4

/** "4,5939" (% a.a.) → 45939 ppm da fração. Vazio → null. */
export function percentTextToPPM(text: string): number | null {
  const pct = parseDecimalBR(text)
  return pct == null ? null : Math.round(pct * 10 ** RATE_DECIMALS)
}

/** 45939 ppm → "4,5939", para carregar no formulário. */
export function ppmToPercentText(ppm?: number | null): string {
  return ppm == null ? '' : formatDecimalBR(ppm / 10 ** RATE_DECIMALS, RATE_DECIMALS)
}

/** 45939 ppm → "4,5939% a.a."; sem taxa → "—". */
export function formatRatePPM(ppm?: number | null): string {
  return ppm == null ? '—' : `${ppmToPercentText(ppm)}% a.a.`
}

/** Texto do MoneyField → centavos; campo vazio → null (valor não informado). */
export function optionalCents(text: string): number | null {
  return text.trim() ? reaisToCents(text) : null
}

/** Centavos → texto que o MoneyField mascara ao carregar. */
export function centsToFieldText(cents?: number | null): string {
  return cents == null ? '' : String(cents)
}

export function formatDateBR(iso?: string | null): string {
  if (!iso || iso.length < 10) return '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/** Meses inteiros entre duas datas ISO, ignorando o dia. */
function monthsBetween(fromISO: string, toISO: string): number {
  const [fy, fm] = fromISO.split('-').map(Number)
  const [ty, tm] = toISO.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/**
 * Número provável da parcela que vence em `referenceDate`, supondo a primeira
 * um mês depois da compra. É só sugestão: carência e obra deslocam a conta, e
 * o número certo é o que o banco mostra.
 */
export function suggestInstallmentNumber(purchaseDate: string, referenceDate: string): number | null {
  if (purchaseDate.length < 10 || referenceDate.length < 10) return null
  const n = monthsBetween(purchaseDate, referenceDate)
  return n >= 1 ? n : null
}

export type FinancingSchedule = {
  firstDueDate: string
  lastDueDate: string
  /** Parcelas anteriores à atual. */
  pastCount: number
  /** Da atual até a última (o "prazo restante" do banco). */
  remainingCount: number
}

/** Posição da série a partir da parcela de referência; null se incoerente. */
export function financingSchedule(
  referenceDate: string,
  referenceInstallment: number,
  termMonths: number,
): FinancingSchedule | null {
  if (referenceDate.length < 10 || !Number.isInteger(termMonths) || termMonths < 2) return null
  if (
    !Number.isInteger(referenceInstallment) ||
    referenceInstallment < 1 ||
    referenceInstallment > termMonths
  ) {
    return null
  }
  return {
    firstDueDate: addMonthsClamped(referenceDate, 1 - referenceInstallment),
    lastDueDate: addMonthsClamped(referenceDate, termMonths - referenceInstallment),
    pastCount: referenceInstallment - 1,
    remainingCount: termMonths - referenceInstallment + 1,
  }
}

/** Valor opcional do contrato: não informado aparece como "—", não como R$ 0,00. */
export function formatOptionalCents(cents?: number | null): string {
  return cents == null ? '—' : formatCents(cents)
}
