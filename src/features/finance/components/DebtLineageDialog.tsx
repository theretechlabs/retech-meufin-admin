import { Fragment, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha,
} from '@mui/material'
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded'
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import { useQuery } from '@tanstack/react-query'
import { formatCents, getDebtLineage, type DebtStage, type Entry, type Renegotiation } from '../api'
import { errorMessage, financeKeys } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { ErrorState, LoadingState } from '@/features/health/components/StateViews'

function formatDateBR(iso?: string | null): string {
  if (!iso || iso.length < 10) return '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function todayISO(): string {
  const t = new Date()
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

function AdjustmentChip({ cents }: { cents: number }) {
  if (cents > 0) return <Chip size="small" color="error" variant="outlined" label={`+${formatCents(cents)} juros`} />
  if (cents < 0) return <Chip size="small" color="success" variant="outlined" label={`−${formatCents(-cents)} desconto`} />
  return <Chip size="small" variant="outlined" label="sem ajuste" />
}

/** Situação de um lançamento dentro da história da dívida. */
function EntryStatusChip({ e, today, isPayoff }: { e: Entry; today: string; isPayoff: boolean }) {
  if (e.status === 'realizada') {
    const paid = e.paid_amount_cents ?? e.amount_cents
    const partial = !isPayoff && paid < e.amount_cents
    const label = isPayoff ? 'Quitação' : partial ? 'Parcial' : 'Paga'
    return (
      <Chip
        size="small"
        color="success"
        variant={partial ? 'outlined' : 'filled'}
        label={`${label}${e.paid_at ? ` em ${formatDateBR(e.paid_at)}` : ''} · ${formatCents(paid)}${
          isPayoff && e.discount_cents ? ` (−${formatCents(e.discount_cents)})` : ''
        }`}
      />
    )
  }
  if (e.status === 'cancelada') {
    if (e.settled_by_renegotiation_id) {
      if (e.cancel_reason === 'quitacao') {
        return <Chip size="small" color="success" variant="outlined" label="Encerrada na quitação" />
      }
      return <Chip size="small" color="info" variant="outlined" label="Levada ao novo acordo" />
    }
    return <Chip size="small" variant="outlined" label="Cancelada" />
  }
  if (e.due_date < today) return <Chip size="small" color="warning" label="Atrasada" />
  return <Chip size="small" variant="outlined" label="Em aberto" />
}

function Stat({
  label,
  value,
  hint,
  color,
}: {
  label: string
  value: string
  hint?: string
  color?: string
}) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="h6" fontWeight={800} color={color} sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  )
}

function closedByLabel(ev: Renegotiation): string {
  return ev.kind === 'troca_bem' ? 'Encerrada por troca' : 'Quitada antecipadamente'
}

function StageCard({
  stage,
  isLast,
  today,
  closedBy,
}: {
  stage: DebtStage
  isLast: boolean
  today: string
  closedBy: Renegotiation | null
}) {
  const [open, setOpen] = useState(isLast)
  const r = stage.renegotiation
  const title = r ? `Acordo ${stage.index} — ${formatDateBR(r.date)}` : 'Parcelamento original'
  const period =
    stage.first_due_date && stage.last_due_date
      ? `${formatDateBR(stage.first_due_date)} a ${formatDateBR(stage.last_due_date)}`
      : ''
  const perInstallment = stage.installment_total > 0 ? Math.round(stage.total_cents / stage.installment_total) : 0
  const payoffId = stage.payoff_entry?.id
  const carriedLabel = closedBy ? 'Encerradas na quitação' : 'Levadas ao próximo acordo'

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: (t) => (isLast && stage.open_count > 0 ? t.palette.primary.main : t.palette.divider),
        bgcolor: (t) => (isLast && stage.open_count > 0 ? alpha(t.palette.primary.main, 0.03) : undefined),
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          {r ? <HandshakeRoundedIcon fontSize="small" color="action" /> : <FlagRoundedIcon fontSize="small" color="action" />}
          <Typography variant="subtitle1" fontWeight={800}>
            {title}
          </Typography>
          {r && <AdjustmentChip cents={r.adjustment_cents} />}
          {isLast && stage.open_count > 0 && <Chip size="small" color="primary" label="Vigente" />}
          {isLast && stage.open_count === 0 && closedBy && (
            <Chip size="small" color="success" icon={<CheckCircleRoundedIcon />} label={closedByLabel(closedBy)} />
          )}
          {isLast && stage.open_count === 0 && !closedBy && <Chip size="small" color="success" label="Quitada" />}
          {!isLast && <Chip size="small" variant="outlined" label="Substituída" />}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => setOpen((v) => !v)} aria-label="Ver lançamentos">
            {open ? <KeyboardArrowUpRoundedIcon /> : <KeyboardArrowDownRoundedIcon />}
          </IconButton>
        </Stack>

        <Typography variant="body2" color="text.secondary">
          {stage.installment_total}× de {formatCents(perInstallment)} = <strong>{formatCents(stage.total_cents)}</strong>
          {period && ` · ${period}`}
          {r && ` · saldo apurado ${formatCents(r.settled_amount_cents)} → novo acordo ${formatCents(r.new_amount_cents)}`}
        </Typography>

        <Grid container spacing={2}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Stat label="Pagas" value={formatCents(stage.paid_cents)} hint={`${stage.paid_count} lançamento(s)`} color="success.main" />
          </Grid>
          {stage.carried_count > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat
                label={carriedLabel}
                value={formatCents(stage.carried_cents)}
                hint={`${stage.carried_count} cobrança(s)`}
                color="info.main"
              />
            </Grid>
          )}
          {closedBy?.payoff_cents != null && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat
                label="Quitação"
                value={formatCents(closedBy.payoff_cents)}
                hint={
                  closedBy.adjustment_cents < 0
                    ? `economia de ${formatCents(-closedBy.adjustment_cents)}`
                    : closedBy.adjustment_cents > 0
                      ? `encargos de ${formatCents(closedBy.adjustment_cents)}`
                      : 'pelo saldo exato'
                }
                color="success.main"
              />
            </Grid>
          )}
          {stage.open_count > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat
                label="Em aberto"
                value={formatCents(stage.open_cents)}
                hint={
                  stage.overdue_count > 0
                    ? `${stage.open_count} parcela(s) · ${stage.overdue_count} atrasada(s) (${formatCents(stage.overdue_cents)})`
                    : `${stage.open_count} parcela(s)`
                }
                color={stage.overdue_count > 0 ? 'warning.main' : undefined}
              />
            </Grid>
          )}
          {stage.cancelled_count > 0 && (
            <Grid size={{ xs: 6, sm: 3 }}>
              <Stat label="Canceladas" value={formatCents(stage.cancelled_cents)} hint={`${stage.cancelled_count} lançamento(s)`} />
            </Grid>
          )}
        </Grid>

        <Collapse in={open} unmountOnExit>
          <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 320 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 90 }}>Parcela</TableCell>
                  <TableCell sx={{ width: 110 }}>Vencimento</TableCell>
                  <TableCell align="right" sx={{ width: 120 }}>
                    Valor
                  </TableCell>
                  <TableCell>Situação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {stage.entries.map((e) => {
                  const isPayoff = e.id === payoffId
                  return (
                    <TableRow key={e.id} hover sx={isPayoff ? { bgcolor: (t) => alpha(t.palette.success.main, 0.06) } : undefined}>
                      <TableCell>
                        {isPayoff
                          ? 'Quitação'
                          : e.residual_of_id
                            ? 'Residual'
                            : e.installment_number && e.installment_total
                              ? `${e.installment_number}/${e.installment_total}`
                              : '—'}
                      </TableCell>
                      <TableCell>{formatDateBR(e.due_date)}</TableCell>
                      <TableCell align="right">{formatCents(e.amount_cents)}</TableCell>
                      <TableCell>
                        <EntryStatusChip e={e} today={today} isPayoff={isPayoff} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Stack>
    </Paper>
  )
}

/**
 * Linhagem da dívida: do parcelamento original ao acordo vigente, etapa a
 * etapa, com o balanço consolidado no topo. Responde às duas perguntas que a
 * tela de renegociação sozinha não responde — "quanto eu já paguei disso
 * tudo?" e "quanto essa dívida custou de verdade, somando os acordos?".
 *
 * Uma troca de bem encerra a dívida e cria OUTRA (no bem novo): a linhagem
 * termina aqui e oferece o salto para o contrato sucessor — e, do lado de
 * lá, o salto de volta para o antecessor.
 */
export function DebtLineageDialog({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const renegotiationKind = useCatalog('finance.renegotiation_kind')
  const [gid, setGid] = useState(groupId)
  const q = useQuery({
    queryKey: financeKeys.debtLineage(gid),
    queryFn: () => getDebtLineage(gid),
  })
  const l = q.data
  const today = todayISO()
  const paidPct = l && l.current_total_cents > 0 ? Math.min(100, Math.round((l.paid_cents / l.current_total_cents) * 100)) : 0
  const closedBy = l?.closed_by ?? null

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <span>Histórico da dívida</span>
          {l && closedBy && (
            <Chip size="small" color="success" icon={<CheckCircleRoundedIcon />} label={closedByLabel(closedBy)} />
          )}
          {l && !closedBy && (
            <Chip
              size="small"
              color={l.settled ? 'success' : 'primary'}
              label={l.settled ? 'Quitada' : `${l.renegotiation_count} acordo(s)`}
            />
          )}
          {l?.origin_event && (
            <Chip size="small" variant="outlined" icon={<SwapHorizRoundedIcon />} label="Nasceu de uma troca" />
          )}
        </Stack>
        {l && (
          <Typography variant="body2" color="text.secondary" fontWeight={400}>
            {l.description}
          </Typography>
        )}
      </DialogTitle>
      <DialogContent>
        {q.isLoading && <LoadingState label="Montando a linhagem…" />}
        {q.isError && <ErrorState message={errorMessage(q.error)} />}
        {l && (
          <Stack spacing={2.5} sx={{ mt: 0.5 }}>
            {l.origin_event && l.predecessor_group_id && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderStyle: 'dashed' }}>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <SwapHorizRoundedIcon fontSize="small" color="action" />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    Este financiamento nasceu da troca em {formatDateBR(l.origin_event.date)}
                    {l.origin_event.net_downpayment_cents != null &&
                      ` · entrada líquida ${formatCents(l.origin_event.net_downpayment_cents)}`}
                    .
                  </Typography>
                  <Button size="small" startIcon={<ArrowBackRoundedIcon />} onClick={() => setGid(l.predecessor_group_id as string)}>
                    Contrato anterior
                  </Button>
                </Stack>
              </Paper>
            )}

            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Stat label="Dívida original" value={formatCents(l.original_cents)} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Stat label="Encargos" value={l.interest_cents > 0 ? `+${formatCents(l.interest_cents)}` : '—'} color={l.interest_cents > 0 ? 'error.main' : undefined} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Stat label="Descontos" value={l.discount_cents > 0 ? `−${formatCents(l.discount_cents)}` : '—'} color={l.discount_cents > 0 ? 'success.main' : undefined} />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Stat label="Total da dívida" value={formatCents(l.current_total_cents)} hint="original + encargos − descontos" />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Stat label="Já pago" value={formatCents(l.paid_cents)} hint={`${l.paid_count} lançamento(s)`} color="success.main" />
                </Grid>
                <Grid size={{ xs: 6, sm: 4, md: 2 }}>
                  <Stat
                    label="Em aberto"
                    value={formatCents(l.open_cents)}
                    hint={l.overdue_count > 0 ? `${l.overdue_count} atrasada(s) · ${formatCents(l.overdue_cents)}` : `${l.open_count} parcela(s)`}
                    color={l.overdue_count > 0 ? 'warning.main' : undefined}
                  />
                </Grid>
              </Grid>
              <Stack spacing={0.5} sx={{ mt: 2 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">
                    Quitado
                  </Typography>
                  <Typography variant="caption" fontWeight={700}>
                    {paidPct}%
                  </Typography>
                </Stack>
                <LinearProgress variant="determinate" value={paidPct} color={l.settled ? 'success' : 'primary'} sx={{ height: 8, borderRadius: 4 }} />
              </Stack>
            </Paper>

            <Divider>
              <Typography variant="caption" color="text.secondary">
                Etapas
              </Typography>
            </Divider>

            <Stack spacing={1}>
              {l.stages.map((st, i) => {
                const next = l.stages[i + 1]
                const isLast = i === l.stages.length - 1
                return (
                  <Fragment key={st.group_id}>
                    <StageCard stage={st} isLast={isLast} today={today} closedBy={isLast ? closedBy : null} />
                    {next?.renegotiation && (
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ pl: 2 }}>
                        <ArrowDownwardRoundedIcon fontSize="small" color="action" />
                        <Typography variant="caption" color="text.secondary">
                          {formatCents(st.carried_cents)} em aberto renegociados em {formatDateBR(next.renegotiation.date)}
                          {next.renegotiation.adjustment_cents !== 0 && (
                            <>
                              {' '}
                              ·{' '}
                              <Tooltip title="Diferença entre o saldo apurado e o valor do novo acordo">
                                <span>
                                  {next.renegotiation.adjustment_cents > 0 ? '+' : '−'}
                                  {formatCents(Math.abs(next.renegotiation.adjustment_cents))}
                                </span>
                              </Tooltip>
                            </>
                          )}
                        </Typography>
                      </Stack>
                    )}
                  </Fragment>
                )
              })}

              {closedBy && (
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderStyle: 'dashed' }}>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    {closedBy.kind === 'troca_bem' ? (
                      <SwapHorizRoundedIcon fontSize="small" color="action" />
                    ) : (
                      <CheckCircleRoundedIcon fontSize="small" color="success" />
                    )}
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      <strong>{renegotiationKind.labelOf(closedBy.kind)}</strong> em {formatDateBR(closedBy.date)}
                      {closedBy.payoff_cents != null && (
                        <>
                          : {formatCents(closedBy.settled_amount_cents)} em aberto quitados por{' '}
                          <strong>{formatCents(closedBy.payoff_cents)}</strong>
                          {closedBy.adjustment_cents < 0 && ` (economia de ${formatCents(-closedBy.adjustment_cents)})`}
                          {closedBy.adjustment_cents > 0 && ` (encargos de ${formatCents(closedBy.adjustment_cents)})`}
                          {closedBy.payer === 'terceiro' && ' · pago por terceiro, sem caixa'}
                        </>
                      )}
                      {closedBy.kind === 'troca_bem' && closedBy.trade_in_cents != null && (
                        <> · usado valeu {formatCents(closedBy.trade_in_cents)}</>
                      )}
                      .
                    </Typography>
                    {l.successor_group_id && (
                      <Button size="small" endIcon={<ArrowForwardRoundedIcon />} onClick={() => setGid(l.successor_group_id as string)}>
                        Contrato novo
                      </Button>
                    )}
                  </Stack>
                </Paper>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {gid !== groupId && (
          <Button onClick={() => setGid(groupId)} sx={{ mr: 'auto' }}>
            Voltar ao contrato inicial
          </Button>
        )}
        <Button onClick={onClose} color="inherit">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
