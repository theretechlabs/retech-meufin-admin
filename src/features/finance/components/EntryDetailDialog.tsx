import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { formatCents, listEntryEvents, type Entry, type EntryEvent } from '../api'
import { errorMessage, financeKeys } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { useExpenseCategories } from '../hooks/useExpenseCategories'
import { EntryReceiptsSection } from './EntryReceiptsSection'
import { EntryAttachmentsSection } from './EntryAttachments'
import { ErrorState, LoadingState } from '@/features/health/components/StateViews'

function formatDateBR(iso?: string | null): string {
  if (!iso || iso.length < 10) return '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function formatDateTimeBR(iso?: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

/** Campo rotulado do detalhe; omite quando vazio para a modal não virar formulário de nulos. */
function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null
  return (
    <Grid size={{ xs: 6, sm: 4 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Grid>
  )
}

const EVENT_LABEL: Record<EntryEvent['event'], string> = {
  confirmed: 'Pagamento confirmado',
  settled: 'Liquidado com forma de pagamento',
  reopened: 'Pagamento desfeito',
  cancelled: 'Cancelado',
  due_date_changed: 'Vencimento alterado',
}

function eventDetail(ev: EntryEvent): string {
  switch (ev.event) {
    case 'confirmed':
    case 'settled': {
      const parts: string[] = []
      if (ev.paid_amount_cents != null) parts.push(formatCents(ev.paid_amount_cents))
      if (ev.paid_at) parts.push(`pago em ${formatDateBR(ev.paid_at)}`)
      return parts.join(' — ')
    }
    case 'cancelled':
      return ev.cancel_reason ? `motivo: ${ev.cancel_reason}` : ''
    case 'due_date_changed':
      return `${formatDateBR(ev.old_due_date)} → ${formatDateBR(ev.new_due_date)}`
    default:
      return ''
  }
}

/**
 * Detalhe completo do lançamento: todos os campos + a trilha imutável de
 * eventos (quando foi pago, desfeito, cancelado, reagendado — e por quem).
 * A lista mostra o essencial; aqui é o registro integral.
 */
export function EntryDetailDialog({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const { labelOf } = useExpenseCategories()
  const entryStatus = useCatalog('finance.entry_status')
  const paymentMethod = useCatalog('finance.payment_method')

  const eventsQ = useQuery({
    queryKey: [...financeKeys.all, 'entry-events', entry.id] as const,
    queryFn: () => listEntryEvents(entry.id),
  })
  const events = eventsQ.data ?? []

  const isIncome = entry.kind === 'credit'
  const paid = entry.paid_amount_cents
  const partial = entry.status === 'realizada' && paid != null && paid < entry.amount_cents

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>{entry.description}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              size="small"
              color={
                entry.status === 'realizada'
                  ? 'success'
                  : entry.status === 'prevista'
                    ? 'warning'
                    : 'default'
              }
              label={entryStatus.labelOf(entry.status)}
            />
            <Chip size="small" variant="outlined" label={isIncome ? 'Receita' : 'Despesa'} />
            {entry.installment_number && entry.installment_total && (
              <Chip
                size="small"
                variant="outlined"
                label={`Parcela ${entry.installment_number}/${entry.installment_total}`}
              />
            )}
            {entry.recurrence !== 'none' && (
              <Chip size="small" variant="outlined" label={`Recorrência: ${entry.recurrence}`} />
            )}
            {partial && <Chip size="small" color="info" variant="outlined" label="Pagamento parcial" />}
          </Box>

          <Grid container spacing={1.5}>
            <Field label="Valor" value={formatCents(entry.amount_cents)} />
            <Field
              label={isIncome ? 'Recebido' : 'Pago'}
              value={paid != null ? formatCents(paid) : undefined}
            />
            <Field label="Data do pagamento" value={entry.paid_at ? formatDateBR(entry.paid_at) : undefined} />
            <Field label="Vencimento" value={formatDateBR(entry.due_date)} />
            <Field
              label="Data da compra"
              value={entry.purchase_date ? formatDateBR(entry.purchase_date) : undefined}
            />
            <Field
              label="Forma de pagamento"
              value={entry.payment_method ? paymentMethod.labelOf(entry.payment_method) : undefined}
            />
            <Field
              label="Desconto"
              value={entry.discount_cents ? formatCents(entry.discount_cents) : undefined}
            />
            <Field label="Motivo do desconto" value={entry.discount_reason ?? undefined} />
            <Field
              label={isIncome ? 'Multa recebida' : 'Multa paga'}
              value={entry.late_fee_cents ? formatCents(entry.late_fee_cents) : undefined}
            />
            <Field
              label={isIncome ? 'Juros recebidos' : 'Juros pagos'}
              value={entry.late_interest_cents ? formatCents(entry.late_interest_cents) : undefined}
            />
            <Field
              label="Termos de atraso"
              value={
                entry.late_fee_bp != null || entry.late_interest_monthly_bp != null
                  ? `multa ${((entry.late_fee_bp ?? 0) / 100).toLocaleString('pt-BR')}% · juros ${((entry.late_interest_monthly_bp ?? 0) / 100).toLocaleString('pt-BR')}% a.m.`
                  : 'Padrão (2% + 1% a.m.)'
              }
            />
            <Field label="Motivo do cancelamento" value={entry.cancel_reason ?? undefined} />
            <Field
              label="Categoria"
              value={entry.type ? labelOf(entry.type as string) : undefined}
            />
          </Grid>

          {entry.notes && (
            <>
              <Divider />
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Notas
                </Typography>
                <Typography variant="body2">{entry.notes}</Typography>
              </Box>
            </>
          )}

          {(entry.residual_of_id || entry.renegotiation_id) && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {entry.residual_of_id && (
                <Chip size="small" variant="outlined" color="warning" label="Residual de pagamento parcial" />
              )}
              {entry.renegotiation_id && (
                <Chip size="small" variant="outlined" color="info" label="Vinculado a renegociação" />
              )}
            </Box>
          )}

          <Divider />

          <EntryAttachmentsSection
            entryId={entry.id}
            readOnly={entry.status === 'cancelada'}
            inSeries={Boolean(entry.recurrence_group_id)}
          />

          <Divider />

          <EntryReceiptsSection entryId={entry.id} readOnly={entry.status === 'cancelada'} />

          <Divider />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Histórico
            </Typography>
            {eventsQ.isLoading && <LoadingState label="Carregando histórico…" />}
            {eventsQ.isError && <ErrorState message={errorMessage(eventsQ.error)} />}
            {eventsQ.isSuccess && events.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Sem eventos registrados — a trilha passou a ser gravada em agosto/2026; ações
                anteriores não têm registro.
              </Typography>
            )}
            {events.length > 0 && (
              <Stack spacing={1}>
                {events.map((ev) => (
                  <Box key={ev.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 110 }}>
                      {formatDateTimeBR(ev.created_at)}
                    </Typography>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {EVENT_LABEL[ev.event]}
                      </Typography>
                      {eventDetail(ev) && (
                        <Typography variant="caption" color="text.secondary">
                          {eventDetail(ev)}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} color="inherit">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
