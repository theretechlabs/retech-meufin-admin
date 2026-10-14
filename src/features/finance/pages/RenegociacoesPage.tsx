import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded'
import { useQuery } from '@tanstack/react-query'
import {
  formatCents,
  getRenegotiationDetail,
  listRenegotiations,
  type Entry,
  type Renegotiation,
} from '../api'
import { errorMessage, financeKeys } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { DebtLineageDialog } from '../components/DebtLineageDialog'
import { PageHeader } from '@/features/health/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'

function formatDateBR(iso: string): string {
  if (!iso || iso.length < 10) return iso
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

/**
 * Chip do ajuste: positivo = encargo/juros (a dívida cresceu no acordo),
 * negativo = desconto obtido. O valor está DILUÍDO nas parcelas novas — é
 * assim que a contabilidade reconhece juros capitalizados, ao longo do
 * prazo — e esta tela existe para ele não ficar invisível por causa disso.
 */
function AdjustmentChip({ cents }: { cents: number }) {
  if (cents > 0) {
    return <Chip size="small" color="error" variant="outlined" label={`+${formatCents(cents)} juros`} />
  }
  if (cents < 0) {
    return <Chip size="small" color="success" variant="outlined" label={`−${formatCents(-cents)} desconto`} />
  }
  return <Chip size="small" variant="outlined" label="sem ajuste" />
}

function KindChip({ kind }: { kind: Renegotiation['kind'] }) {
  const renegotiationKind = useCatalog('finance.renegotiation_kind')
  const color = kind === 'renegociacao' ? 'info' : kind === 'quitacao' ? 'success' : 'primary'
  return <Chip size="small" color={color} variant="outlined" label={renegotiationKind.labelOf(kind)} />
}

function EntriesTable({ title, entries }: { title: string; entries: Entry[] }) {
  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {title} ({entries.length})
      </Typography>
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1, maxHeight: 260 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell sx={{ width: 110 }}>Vencimento</TableCell>
              <TableCell sx={{ width: 80 }} align="right">
                Parcela
              </TableCell>
              <TableCell sx={{ width: 120 }} align="right">
                Valor
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{e.description}</TableCell>
                <TableCell>{formatDateBR(e.due_date)}</TableCell>
                <TableCell align="right">
                  {e.installment_number && e.installment_total
                    ? `${e.installment_number}/${e.installment_total}`
                    : '—'}
                </TableCell>
                <TableCell align="right">{formatCents(e.amount_cents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

function RenegotiationDetailDialog({
  renegotiation,
  onClose,
  onOpenLineage,
}: {
  renegotiation: Renegotiation
  onClose: () => void
  onOpenLineage: (groupId: string) => void
}) {
  const detailQ = useQuery({
    queryKey: [...financeKeys.renegotiations(), renegotiation.id] as const,
    queryFn: () => getRenegotiationDetail(renegotiation.id),
  })
  const d = detailQ.data

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        {renegotiation.description} — {formatDateBR(renegotiation.date)}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <KindChip kind={renegotiation.kind} />
            {renegotiation.origin_count > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Saldo apurado
                </Typography>
                <Typography variant="h6">{formatCents(renegotiation.settled_amount_cents)}</Typography>
              </Box>
            )}
            {renegotiation.origin_count > 0 && (
              <Typography variant="h6" color="text.secondary">
                →
              </Typography>
            )}
            {renegotiation.kind === 'renegociacao' ? (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Novo acordo
                </Typography>
                <Typography variant="h6">{formatCents(renegotiation.new_amount_cents)}</Typography>
              </Box>
            ) : (
              renegotiation.payoff_cents != null && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Quitação{renegotiation.payer === 'terceiro' ? ' (por terceiro)' : ''}
                  </Typography>
                  <Typography variant="h6">{formatCents(renegotiation.payoff_cents)}</Typography>
                </Box>
              )
            )}
            {renegotiation.origin_count > 0 && <AdjustmentChip cents={renegotiation.adjustment_cents} />}
            {renegotiation.kind === 'troca_bem' && (
              <>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Usado valeu
                  </Typography>
                  <Typography variant="h6">{formatCents(renegotiation.trade_in_cents ?? 0)}</Typography>
                </Box>
                {(renegotiation.cash_downpayment_cents ?? 0) > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Entrada em dinheiro
                    </Typography>
                    <Typography variant="h6">{formatCents(renegotiation.cash_downpayment_cents ?? 0)}</Typography>
                  </Box>
                )}
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Entrada líquida
                  </Typography>
                  <Typography variant="h6" fontWeight={800}>
                    {formatCents(renegotiation.net_downpayment_cents ?? 0)}
                  </Typography>
                </Box>
                {renegotiation.new_count > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Financiamento novo
                    </Typography>
                    <Typography variant="h6">{formatCents(renegotiation.new_amount_cents)}</Typography>
                  </Box>
                )}
              </>
            )}
          </Box>

          {renegotiation.notes && (
            <Typography variant="body2" color="text.secondary">
              {renegotiation.notes}
            </Typography>
          )}

          {detailQ.isLoading && <LoadingState label="Carregando o detalhe…" />}
          {detailQ.isError && <ErrorState message={errorMessage(detailQ.error)} />}
          {d && (
            <>
              {d.paid_before_count > 0 ? (
                <EntriesTable
                  title={`Pagas antes do evento (${d.paid_before_count} · ${formatCents(d.paid_before_cents)})`}
                  entries={d.paid_before}
                />
              ) : (
                renegotiation.origin_count > 0 && (
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma parcela do contrato anterior tinha sido paga antes deste evento.
                  </Typography>
                )
              )}
              {d.origins.length > 0 && <EntriesTable title="Cobranças encerradas" entries={d.origins} />}
              {renegotiation.kind === 'renegociacao' ? (
                <EntriesTable title="Parcelas criadas" entries={d.created} />
              ) : (
                <>
                  {d.created.some((e) => !e.installment_number) && (
                    <EntriesTable
                      title="Lançamentos do evento (quitação, venda, entrada)"
                      entries={d.created.filter((e) => !e.installment_number)}
                    />
                  )}
                  {d.created.some((e) => e.installment_number) && (
                    <EntriesTable
                      title="Parcelas do financiamento novo"
                      entries={d.created.filter((e) => e.installment_number)}
                    />
                  )}
                </>
              )}
              {(d.previous_renegotiation_id || d.next_renegotiation_id) && (
                <Typography variant="caption" color="text.secondary">
                  {d.previous_renegotiation_id && 'Este acordo repactuou um acordo anterior. '}
                  {d.next_renegotiation_id && 'Este acordo já foi repactuado por um acordo posterior. '}
                  O histórico completo da dívida está na linhagem.
                </Typography>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        {(d?.root_group_id || renegotiation.origin_group_id || renegotiation.new_group_id) && (
          <Button
            startIcon={<AccountTreeRoundedIcon />}
            onClick={() =>
              onOpenLineage(
                (d?.root_group_id ?? renegotiation.origin_group_id ?? renegotiation.new_group_id) as string
              )
            }
            sx={{ mr: 'auto' }}
          >
            Histórico da dívida
          </Button>
        )}
        <Button onClick={onClose} color="inherit">
          Fechar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function RenegociacoesPage() {
  const [selected, setSelected] = useState<Renegotiation | null>(null)
  const [lineageGroup, setLineageGroup] = useState<string | null>(null)

  const listQ = useQuery({
    queryKey: financeKeys.renegotiations(),
    queryFn: listRenegotiations,
  })
  const items = useMemo(() => listQ.data ?? [], [listQ.data])

  const totals = useMemo(() => {
    let settled = 0
    let interest = 0
    let discount = 0
    for (const r of items) {
      settled += r.settled_amount_cents
      if (r.adjustment_cents > 0) interest += r.adjustment_cents
      if (r.adjustment_cents < 0) discount += -r.adjustment_cents
    }
    return { settled, interest, discount }
  }, [items])

  return (
    <>
      <PageHeader
        title="Renegociações e quitações"
        subtitle="Acordos, quitações antecipadas e trocas de bem que encerraram dívidas em aberto — e quanto cada um custou (ou economizou)."
      />

      {listQ.isLoading && <LoadingState label="Carregando renegociações…" />}
      {listQ.isError && <ErrorState message={errorMessage(listQ.error)} />}

      {listQ.isSuccess && items.length === 0 && (
        <EmptyState
          title="Nenhuma renegociação registrada"
          description="Renegocie, quite ou registre a troca de um bem financiado pela tela de Parcelamentos (ou pelo veículo, na Frota): o saldo em aberto é apurado e encerrado, preservando o histórico."
        />
      )}

      {items.length > 0 && (
        <Stack spacing={3}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Dívida encerrada
                      </Typography>
                      <Typography variant="h6" fontWeight={800}>
                        {formatCents(totals.settled)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {items.length} evento(s)
                      </Typography>
                    </Box>
                    <HandshakeRoundedIcon color="info" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Custo em juros/encargos
                      </Typography>
                      <Typography variant="h6" fontWeight={800} color="error.main">
                        {formatCents(totals.interest)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        diluídos nas parcelas novas
                      </Typography>
                    </Box>
                    <TrendingUpRoundedIcon color="error" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Descontos obtidos
                      </Typography>
                      <Typography variant="h6" fontWeight={800} color="success.main">
                        {formatCents(totals.discount)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        abatidos do saldo devido
                      </Typography>
                    </Box>
                    <SavingsRoundedIcon color="success" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 110 }}>Data</TableCell>
                    <TableCell sx={{ width: 150 }}>Tipo</TableCell>
                    <TableCell>Dívida</TableCell>
                    <TableCell align="right">Saldo apurado</TableCell>
                    <TableCell align="right">Desfecho</TableCell>
                    <TableCell>Ajuste</TableCell>
                    <TableCell align="right">Cobranças</TableCell>
                    <TableCell align="right" sx={{ width: 64 }} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((r) => (
                    <TableRow
                      key={r.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setSelected(r)}
                    >
                      <TableCell>{formatDateBR(r.date)}</TableCell>
                      <TableCell>
                        <KindChip kind={r.kind} />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.description}</TableCell>
                      <TableCell align="right">{r.origin_count > 0 ? formatCents(r.settled_amount_cents) : '—'}</TableCell>
                      <TableCell align="right">
                        {r.kind === 'renegociacao' ? (
                          formatCents(r.new_amount_cents)
                        ) : (
                          <>
                            {r.payoff_cents != null ? formatCents(r.payoff_cents) : '—'}
                            {r.kind === 'troca_bem' && r.new_count > 0 && (
                              <Typography variant="caption" display="block" color="text.secondary">
                                novo: {formatCents(r.new_amount_cents)}
                              </Typography>
                            )}
                          </>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.origin_count > 0 ? <AdjustmentChip cents={r.adjustment_cents} /> : '—'}
                      </TableCell>
                      <TableCell align="right">
                        {r.origin_count} → {r.new_count}
                      </TableCell>
                      <TableCell align="right">
                        {(r.origin_group_id || r.new_group_id) && (
                          <Tooltip title="Histórico da dívida">
                            <IconButton
                              size="small"
                              onClick={(ev) => {
                                ev.stopPropagation()
                                setLineageGroup((r.origin_group_id ?? r.new_group_id) as string)
                              }}
                            >
                              <AccountTreeRoundedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>

          <Typography variant="caption" color="text.secondary">
            Na renegociação o ajuste está embutido nas parcelas do novo acordo — juros
            capitalizados são reconhecidos ao longo do prazo. Na quitação e na troca, o desconto
            fica no lançamento de quitação. Esta tela existe para esse custo (ou economia) nunca
            ficar invisível. Clique num evento para ver o que foi encerrado e o que nasceu.
          </Typography>
        </Stack>
      )}

      {selected && (
        <RenegotiationDetailDialog
          renegotiation={selected}
          onClose={() => setSelected(null)}
          onOpenLineage={(g) => {
            setSelected(null)
            setLineageGroup(g)
          }}
        />
      )}

      {lineageGroup && <DebtLineageDialog groupId={lineageGroup} onClose={() => setLineageGroup(null)} />}
    </>
  )
}
