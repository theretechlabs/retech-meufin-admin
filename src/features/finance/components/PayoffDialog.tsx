import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Step,
  StepLabel,
  Stepper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createPayoff,
  formatCents,
  getRenegotiationPreview,
  listAccounts,
  reaisToCents,
  type Payer,
  type PaymentMethod,
  type RenegotiationPreview,
} from '../api'
import {
  ACCOUNT_PAYMENT_METHODS,
  errorMessage,
  financeKeys,
  PAYMENT_METHOD_OPTIONS,
} from '../constants'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { MoneyField } from '@/components/fields/MoneyField'
import { ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { todayISO } from '../installments'

const STEPS = ['Saldo devedor', 'Quitação', 'Confirmar']

function formatDateBR(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/**
 * Quitação antecipada de um contrato parcelado.
 *
 * O saldo apurado vira o valor do lançamento de quitação e a diferença para
 * o que foi pago vira desconto (motivo "quitação antecipada") — a economia
 * fica visível nos relatórios sem inventar lançamento negativo. Se quem
 * pagou foi um terceiro (concessionária numa troca), a liquidação é por
 * compensação: nada sai do caixa do usuário.
 */
export function PayoffDialog({
  groupId,
  onClose,
  defaultPayer = 'proprio',
  onDone,
}: {
  groupId: string
  onClose: () => void
  defaultPayer?: Payer
  onDone?: () => void
}) {
  const qc = useQueryClient()
  const { show } = useToast()

  const [step, setStep] = useState(0)
  const [date, setDate] = useState(todayISO())
  const [amountText, setAmountText] = useState('')
  const [payer, setPayer] = useState<Payer>(defaultPayer)
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [accountId, setAccountId] = useState('')
  const [notes, setNotes] = useState('')

  const previewQuery = useQuery<RenegotiationPreview>({
    queryKey: financeKeys.renegotiationPreview(groupId),
    queryFn: () => getRenegotiationPreview(groupId),
  })
  const preview = previewQuery.data
  const { data: accounts } = useQuery({ queryKey: financeKeys.accounts(), queryFn: listAccounts })

  const openTotal = preview?.open_total_cents ?? 0
  const payoffCents = reaisToCents(amountText)
  const delta = payoffCents - openTotal
  const needsAccount = payer === 'proprio' && (ACCOUNT_PAYMENT_METHODS as readonly string[]).includes(method)
  const canAdvance = payoffCents > 0 && Boolean(date)

  const mutation = useMutation({
    mutationFn: () =>
      createPayoff(groupId, {
        date,
        payoff_cents: payoffCents,
        payer,
        payment_method: payer === 'proprio' ? method : undefined,
        payment_account_id: payer === 'proprio' && needsAccount && accountId ? accountId : null,
        notes: notes.trim() || undefined,
        asset_type: preview?.asset_type ?? null,
        asset_id: preview?.asset_id ?? null,
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show(
        `Contrato quitado: ${res.event.origin_count} cobranças encerradas` +
          (res.event.adjustment_cents < 0
            ? `, economia de ${formatCents(-res.event.adjustment_cents)}.`
            : '.')
      )
      onDone?.()
      onClose()
    },
  })

  return (
    <Dialog open onClose={mutation.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>Quitar contrato</DialogTitle>
      <DialogContent>
        <Stepper activeStep={step} sx={{ mt: 1, mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {previewQuery.isLoading && <LoadingState label="Apurando o saldo devedor…" />}
        {previewQuery.isError && <ErrorState message={errorMessage(previewQuery.error)} />}

        {preview && step === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {preview.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Já pago
                </Typography>
                <Typography variant="h6">{formatCents(preview.paid_cents)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {preview.paid_count} de {preview.installment_total} parcelas
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Saldo em aberto
                </Typography>
                <Typography variant="h6" color="warning.main">
                  {formatCents(preview.open_total_cents)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {preview.installment_count} parcela(s)
                  {preview.residual_count > 0 && ` + ${preview.residual_count} residual(is)`}
                  {preview.overdue_count > 0 && ` · ${preview.overdue_count} atrasada(s)`}
                </Typography>
              </Box>
            </Box>
            <Alert severity="info" sx={{ py: 0.5 }}>
              Este é o saldo devedor pelo contrato. O valor de quitação que o credor oferece
              costuma ser menor (abatimento dos juros futuros) — informe-o no próximo passo.
            </Alert>
          </Box>
        )}

        {preview && step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Saldo a quitar: <strong>{formatCents(openTotal)}</strong>
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <MoneyField
                label="Valor pago na quitação"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                sx={{ minWidth: 200, flex: 1 }}
                autoFocus
              />
              <TextField
                type="date"
                label="Data"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 170 }}
              />
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
                Quem pagou?
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={payer}
                onChange={(_, v: Payer | null) => v && setPayer(v)}
              >
                <ToggleButton value="proprio">Eu, do meu caixa</ToggleButton>
                <ToggleButton value="terceiro">Terceiro (concessionária, comprador)</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {payer === 'proprio' ? (
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <TextField
                  select
                  label="Forma de pagamento"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  sx={{ minWidth: 200, flex: 1 }}
                >
                  {PAYMENT_METHOD_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
                {needsAccount && (
                  <Box sx={{ minWidth: 200, flex: 1 }}>
                    <AutocompleteField
                      label="Conta"
                      emptyLabel="Não informar"
                      value={accountId}
                      onChange={setAccountId}
                      options={(accounts ?? []).map((a) => ({
                        value: a.id,
                        label: a.name,
                        description: a.bank_name ?? undefined,
                      }))}
                    />
                  </Box>
                )}
              </Box>
            ) : (
              <Alert severity="info" sx={{ py: 0.5 }}>
                Pago por terceiro: a quitação é registrada por <strong>compensação</strong> — sai
                dos relatórios de dívida, mas não mexe no seu fluxo de caixa.
              </Alert>
            )}

            <TextField
              label="Observações (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />

            {payoffCents > 0 && (
              <Alert severity={delta < 0 ? 'success' : delta > 0 ? 'warning' : 'info'}>
                {delta < 0 && (
                  <>
                    Economia de <strong>{formatCents(-delta)}</strong> sobre o saldo (desconto de
                    quitação antecipada).
                  </>
                )}
                {delta > 0 && (
                  <>
                    <strong>{formatCents(delta)}</strong> acima do saldo (multa/encargos de
                    quitação).
                  </>
                )}
                {delta === 0 && 'Valor igual ao saldo, sem desconto nem encargo.'}
              </Alert>
            )}
          </Box>
        )}

        {preview && step === 2 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {mutation.isError && <ErrorState message={errorMessage(mutation.error)} />}
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Confira antes de aplicar
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Typography variant="body2">
                <strong>{preview.installment_count + preview.residual_count} cobranças</strong> em
                aberto ({formatCents(openTotal)}) serão encerradas por quitação.
              </Typography>
              <Typography variant="body2">
                Um lançamento <strong>realizado</strong> de{' '}
                <strong>{formatCents(payoffCents)}</strong> em {formatDateBR(date)} registra a
                quitação
                {payer === 'terceiro' ? ' (pago por terceiro, por compensação)' : ''}.
              </Typography>
              {delta < 0 && (
                <Typography variant="body2" color="success.main">
                  Economia de {formatCents(-delta)} registrada como desconto de quitação antecipada.
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                As {preview.paid_count} parcelas já pagas permanecem intactas no histórico.
              </Typography>
            </Box>
            <Divider />
            <Alert severity="info" sx={{ py: 0.5 }}>
              A dívida passa a constar como quitada no histórico, com as parcelas encerradas
              ligadas ao evento de quitação.
            </Alert>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit" disabled={mutation.isPending}>
          Cancelar
        </Button>
        {step > 0 && (
          <Button onClick={() => setStep(step - 1)} disabled={mutation.isPending}>
            Voltar
          </Button>
        )}
        {step === 0 && (
          <Button
            variant="contained"
            onClick={() => setStep(1)}
            disabled={!preview || preview.installment_count + preview.residual_count === 0}
          >
            Continuar
          </Button>
        )}
        {step === 1 && (
          <Button variant="contained" onClick={() => setStep(2)} disabled={!canAdvance}>
            Revisar
          </Button>
        )}
        {step === 2 && (
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            Quitar contrato
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
