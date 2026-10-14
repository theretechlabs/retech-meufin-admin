import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { formatCents, waiveEntry, WAIVER_REASON_SLUGS, type Entry } from '../api'
import { errorMessage, financeKeys } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { ErrorState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Registra que a cobrança não foi devida neste período — bônus, cortesia,
 * ressarcimento que zerou a fatura, cobrança indevida estornada.
 *
 * Por baixo é uma liquidação com desconto integral e valor pago zero: o
 * previsto continua valendo o valor cheio (a mensalidade não mudou) e o
 * realizado fica zero. A recorrência não é afetada — ao contrário de
 * cancelar, que apaga o lançamento dos relatórios e pode encerrar a série.
 */
export function WaiveEntryDialog({
  entry,
  onClose,
}: {
  entry: Entry
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [reason, setReason] = useState('')
  const [date, setDate] = useState(todayIso)

  const isIncome = entry.kind === 'credit'

  const discountReason = useCatalog('finance.discount_reason')
  const allowed = new Set<string>(WAIVER_REASON_SLUGS)
  const options = discountReason.options.filter((o) => allowed.has(o.value))

  const mutation = useMutation({
    mutationFn: () => waiveEntry(entry.id, { reason, paid_at: date || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show(
        isIncome
          ? 'Registrado: nada a receber neste período.'
          : 'Registrado: nada a pagar neste período. A recorrência segue normalmente.'
      )
      onClose()
    },
  })

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {isIncome ? 'Não houve recebimento' : 'Não houve cobrança'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}

          <Typography variant="body2" color="text.secondary">
            {entry.description} — {formatCents(entry.amount_cents)}
          </Typography>

          <AutocompleteField
            label="Motivo"
            value={reason}
            onChange={setReason}
            options={options}
            loading={discountReason.isLoading}
            emptyLabel="Nenhum motivo encontrado"
          />

          <TextField
            type="date"
            label="Data do registro"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />

          <Alert severity="info" sx={{ py: 0.5 }}>
            O valor de {formatCents(entry.amount_cents)} continua no previsto do mês, e o{' '}
            {isIncome ? 'recebido' : 'pago'} fica zerado. A recorrência não é interrompida — use{' '}
            <strong>Cancelar</strong> apenas quando a cobrança não deveria existir.
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Voltar
        </Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={!reason || mutation.isPending}
        >
          Registrar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
