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
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { MoneyField } from '@/components/fields/MoneyField'
import { ErrorState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { formatCents, readjustFinancing, reaisToCents, type FinancingContract } from '../api'
import { errorMessage, financeKeys } from '../constants'
import { centsToFieldText } from '../financing'
import { todayISO } from '../installments'

/**
 * Reajuste da prestação (correção pelo índice do contrato): o valor novo vale
 * para as parcelas em aberto com vencimento a partir da data escolhida.
 */
export function FinancingReadjustDialog({
  contract,
  nextDueDate,
  onClose,
}: {
  contract: FinancingContract
  /** Vencimento da próxima parcela em aberto: ponto de partida sugerido. */
  nextDueDate?: string | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [amount, setAmount] = useState(centsToFieldText(contract.installment_cents))
  const [fromDate, setFromDate] = useState(nextDueDate ?? todayISO())
  const cents = reaisToCents(amount)

  const mutation = useMutation({
    mutationFn: () => readjustFinancing(contract.id, { installment_cents: cents, from_date: fromDate }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show(`Prestação reajustada em ${res.updated} parcela(s).`)
      onClose()
    },
  })

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Reajustar prestação</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
          <Alert severity="info" sx={{ py: 0.5 }}>
            Prestação atual: <strong>{formatCents(contract.installment_cents)}</strong>. Parcelas já pagas não
            mudam.
          </Alert>
          <MoneyField
            label="Novo valor da prestação"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            fullWidth
            required
            autoFocus
          />
          <TextField
            label="Vale a partir do vencimento"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            fullWidth
            required
            InputLabelProps={{ shrink: true }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={() => mutation.mutate()}
          disabled={cents <= 0 || !fromDate || mutation.isPending}
        >
          Reajustar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
