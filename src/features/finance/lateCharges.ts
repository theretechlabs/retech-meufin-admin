import { reaisToCents } from "./api";
import {
  formatDecimalBR,
  parseDecimalBR,
} from "@/components/fields/DecimalField";

/** Multa e juros digitados (texto pt-BR, como o MoneyField trafega). */
export type LateChargesValue = { fee: string; interest: string };

export const EMPTY_LATE_CHARGES: LateChargesValue = { fee: "", interest: "" };

/** Soma dos encargos digitados, em centavos. */
export function lateChargesCents(v: LateChargesValue): number {
  return reaisToCents(v.fee) + reaisToCents(v.interest);
}

export function centsToMoneyText(cents: number): string {
  return cents > 0 ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

/** Basis points (200) → texto percentual pt-BR ("2,00"), para o form. */
export function bpToPercentText(bp: number | null | undefined): string {
  return bp == null ? "" : formatDecimalBR(bp / 100, 2);
}

/** Texto percentual pt-BR ("2,00") → basis points (200). Vazio → null. */
export function percentTextToBp(text: string): number | null {
  const v = parseDecimalBR(text);
  return v == null ? null : Math.round(v * 100);
}
