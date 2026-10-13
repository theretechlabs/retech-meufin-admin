import { useEffect, useRef } from "react";
import { Alert, Button, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import {
  formatCents,
  getLateChargeQuote,
  reaisToCents,
  type LateChargeQuote,
} from "../api";
import { financeKeys } from "../constants";
import { MoneyField } from "@/components/fields/MoneyField";
import {
  centsToMoneyText,
  EMPTY_LATE_CHARGES,
  type LateChargesValue,
} from "../lateCharges";

function pct(bp: number): string {
  return `${(bp / 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}

/**
 * Encargos por atraso ao confirmar/liquidar. Consulta a cotação do backend
 * para a data de pagamento informada e preenche multa e juros como
 * sugestão; o usuário ajusta se o boleto cobrou diferente. Enquanto não
 * mexer nos campos, a sugestão acompanha a data.
 *
 * Em dia (sem atraso) e sem valor digitado: não renderiza nada.
 */
export function LateChargesFields({
  entryId,
  paidAt,
  value,
  onChange,
  disabled,
}: {
  entryId: string;
  /** Data do pagamento (YYYY-MM-DD). Vazia = sem cotação. */
  paidAt: string;
  value: LateChargesValue;
  onChange: (next: LateChargesValue) => void;
  disabled?: boolean;
}) {
  const quoteQ = useQuery({
    queryKey: financeKeys.lateCharges(entryId, paidAt),
    queryFn: () => getLateChargeQuote(entryId, paidAt),
    enabled: Boolean(paidAt),
    staleTime: 60_000,
  });
  const quote = quoteQ.data;

  // O usuário editou? Então a sugestão para de sobrescrever.
  const touched = useRef(false);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  useEffect(() => {
    if (!quote || touched.current) return;
    onChangeRef.current(suggestionOf(quote));
  }, [quote]);

  if (!quote) return null;
  const hasTyped = Boolean(value.fee || value.interest);
  if (quote.days_late <= 0 && !hasTyped) return null;

  const suggested = suggestionOf(quote);
  const differsFromSuggestion =
    reaisToCents(value.fee) !== quote.late_fee_cents ||
    reaisToCents(value.interest) !== quote.late_interest_cents;

  const update = (patch: Partial<LateChargesValue>) => {
    touched.current = true;
    onChange({ ...value, ...patch });
  };

  return (
    <Stack spacing={1.5}>
      {quote.days_late > 0 ? (
        <Alert severity="warning" icon={false} sx={{ py: 0.5 }}>
          <strong>
            {quote.days_late} {quote.days_late === 1 ? "dia" : "dias"} de
            atraso.
          </strong>{" "}
          Sugestão: multa {pct(quote.late_fee_bp)} + juros{" "}
          {pct(quote.late_interest_monthly_bp)} a.m.
          {quote.source === "entry"
            ? " (termos deste lançamento)"
            : " (padrão)"}{" "}
          = <strong>{formatCents(quote.total_cents)}</strong>. Ajuste se o
          boleto cobrou diferente.
        </Alert>
      ) : (
        <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
          Pagamento em dia: encargos informados à mão.
        </Alert>
      )}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <MoneyField
          label="Multa"
          value={value.fee}
          onChange={(e) => update({ fee: e.target.value })}
          fullWidth
          disabled={disabled}
        />
        <MoneyField
          label="Juros"
          value={value.interest}
          onChange={(e) => update({ interest: e.target.value })}
          fullWidth
          disabled={disabled}
        />
      </Stack>
      {quote.days_late > 0 && differsFromSuggestion && (
        <Button
          size="small"
          sx={{ alignSelf: "flex-start" }}
          disabled={disabled}
          onClick={() => {
            touched.current = false;
            onChange(suggested);
          }}
        >
          Usar sugestão ({formatCents(quote.total_cents)})
        </Button>
      )}
    </Stack>
  );
}

function suggestionOf(q: LateChargeQuote): LateChargesValue {
  if (q.days_late <= 0) return EMPTY_LATE_CHARGES;
  return {
    fee: centsToMoneyText(q.late_fee_cents),
    interest: centsToMoneyText(q.late_interest_cents),
  };
}
