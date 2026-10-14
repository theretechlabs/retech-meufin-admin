import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  formatCents,
  getAssetDebts,
  getInstallmentsProjection,
  linkInstallmentGroupAsset,
  type DebtLineage,
  type Renegotiation,
} from '@/features/finance/api'
import { errorMessage, financeKeys } from '@/features/finance/constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { AssetSwapDialog } from '@/features/finance/components/AssetSwapDialog'
import { DebtLineageDialog } from '@/features/finance/components/DebtLineageDialog'
import { PayoffDialog } from '@/features/finance/components/PayoffDialog'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import { vehicleKeys } from '../constants'

function formatDateBR(iso?: string | null): string {
  if (!iso || iso.length < 10) return '—'
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
}

function DebtCard({
  debt,
  vehicleId,
  onLineage,
  onPayoff,
  onSwap,
}: {
  debt: DebtLineage
  vehicleId: string
  onLineage: () => void
  onPayoff: () => void
  onSwap: () => void
}) {
  const pct = debt.current_total_cents > 0 ? Math.min(100, Math.round((debt.paid_cents / debt.current_total_cents) * 100)) : 0
  const closed = debt.closed_by
  const last = debt.stages[debt.stages.length - 1]
  const isSuccessorOfThisVehicle = closed?.kind === 'troca_bem' && closed.new_asset_id === vehicleId

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" fontWeight={800} sx={{ flex: 1 }}>
              {debt.description}
            </Typography>
            {!debt.settled && <Chip size="small" color="primary" label="Vigente" />}
            {debt.settled && closed && (
              <Chip
                size="small"
                color="success"
                icon={closed.kind === 'troca_bem' ? <SwapHorizRoundedIcon /> : <CheckCircleRoundedIcon />}
                label={closed.kind === 'troca_bem' ? 'Encerrado por troca' : 'Quitado antecipadamente'}
              />
            )}
            {debt.settled && !closed && <Chip size="small" color="success" label="Quitado" />}
            {debt.renegotiation_count > 0 && (
              <Chip size="small" variant="outlined" label={`${debt.renegotiation_count} renegociação(ões)`} />
            )}
            {debt.origin_event && !isSuccessorOfThisVehicle && (
              <Chip size="small" variant="outlined" label="Nasceu de uma troca" />
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {last.installment_total}× · {formatDateBR(last.first_due_date)} a {formatDateBR(last.last_due_date)}
          </Typography>

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Total da dívida
              </Typography>
              <Typography variant="h6" fontWeight={800}>
                {formatCents(debt.current_total_cents)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Já pago
              </Typography>
              <Typography variant="h6" fontWeight={800} color="success.main">
                {formatCents(debt.paid_cents)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                Em aberto
              </Typography>
              <Typography variant="h6" fontWeight={800} color={debt.overdue_count > 0 ? 'warning.main' : undefined}>
                {formatCents(debt.open_cents)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {debt.open_count} parcela(s){debt.overdue_count > 0 && ` · ${debt.overdue_count} atrasada(s)`}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                {closed?.payoff_cents != null ? 'Quitação' : 'Descontos'}
              </Typography>
              <Typography variant="h6" fontWeight={800} color="success.main">
                {closed?.payoff_cents != null ? formatCents(closed.payoff_cents) : debt.discount_cents > 0 ? `−${formatCents(debt.discount_cents)}` : '—'}
              </Typography>
              {closed && closed.adjustment_cents < 0 && (
                <Typography variant="caption" color="text.secondary">
                  economia de {formatCents(-closed.adjustment_cents)}
                </Typography>
              )}
            </Grid>
          </Grid>

          <LinearProgress variant="determinate" value={pct} color={debt.settled ? 'success' : 'primary'} sx={{ height: 8, borderRadius: 4 }} />

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" startIcon={<AccountTreeRoundedIcon />} onClick={onLineage}>
              Histórico
            </Button>
            {!debt.settled && (
              <>
                <Button size="small" startIcon={<CheckCircleRoundedIcon />} onClick={onPayoff}>
                  Quitar
                </Button>
                <Button size="small" startIcon={<SwapHorizRoundedIcon />} onClick={onSwap}>
                  Troquei o veículo
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function EventsTable({ events, vehicleId }: { events: Renegotiation[]; vehicleId: string }) {
  const renegotiationKind = useCatalog('finance.renegotiation_kind')
  return (
    <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 110 }}>Data</TableCell>
            <TableCell>Evento</TableCell>
            <TableCell align="right">Quitação</TableCell>
            <TableCell align="right">Usado valeu</TableCell>
            <TableCell align="right">Entrada líquida</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((ev) => {
            const role =
              ev.kind === 'troca_bem' ? (ev.new_asset_id === vehicleId ? 'entrou nesta troca' : 'saiu nesta troca') : ''
            return (
              <TableRow key={ev.id} hover>
                <TableCell>{formatDateBR(ev.date)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Chip size="small" variant="outlined" label={renegotiationKind.labelOf(ev.kind)} />
                    <Typography variant="body2">{ev.description}</Typography>
                    {role && (
                      <Typography variant="caption" color="text.secondary">
                        · {role}
                      </Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  {ev.payoff_cents != null ? (
                    <>
                      {formatCents(ev.payoff_cents)}
                      {ev.adjustment_cents < 0 && (
                        <Typography variant="caption" display="block" color="success.main">
                          −{formatCents(-ev.adjustment_cents)}
                        </Typography>
                      )}
                    </>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right">{ev.trade_in_cents != null ? formatCents(ev.trade_in_cents) : '—'}</TableCell>
                <TableCell align="right">
                  {ev.kind === 'troca_bem' && ev.net_downpayment_cents != null ? formatCents(ev.net_downpayment_cents) : '—'}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

/**
 * Aba "Financiamento" do veículo: os contratos que o financiam (com saldo,
 * progresso e atalhos para quitar/trocar) e os eventos em que ele aparece.
 * Para quem lançou o financiamento antes de existir o vínculo com o bem, há
 * o atalho de vincular um parcelamento existente.
 */
export function VehicleFinanceTab({
  vehicleId,
  vehicleStatus,
}: {
  vehicleId: string
  vehicleStatus: string
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const [lineageGroup, setLineageGroup] = useState<string | null>(null)
  const [payoffGroup, setPayoffGroup] = useState<string | null>(null)
  const [swapGroup, setSwapGroup] = useState<string | null | undefined>(undefined) // undefined = fechado
  const [linking, setLinking] = useState(false)
  const [linkGroup, setLinkGroup] = useState('')

  const q = useQuery({
    queryKey: financeKeys.assetDebts('vehicle', vehicleId),
    queryFn: () => getAssetDebts('vehicle', vehicleId),
  })
  const projectionQ = useQuery({
    queryKey: [...financeKeys.all, 'installments-projection'] as const,
    queryFn: getInstallmentsProjection,
    enabled: linking,
  })
  const linkOptions = useMemo(() => {
    const linked = new Set((q.data?.debts ?? []).flatMap((d) => d.stages.map((s) => s.group_id)))
    return (projectionQ.data?.groups ?? [])
      .filter((g) => g.source === 'expense' && g.group_id && !linked.has(g.group_id))
      .map((g) => ({
        value: g.group_id as string,
        label: g.description,
        description: `${g.remaining_count}x restantes · ${formatCents(g.remaining_cents)}`,
      }))
  }, [projectionQ.data, q.data])

  const linkMutation = useMutation({
    mutationFn: () => linkInstallmentGroupAsset(linkGroup, { asset_type: 'vehicle', asset_id: vehicleId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      qc.invalidateQueries({ queryKey: vehicleKeys.all })
      show(`${res.entries_updated} parcela(s) vinculada(s) ao veículo.`)
      setLinking(false)
      setLinkGroup('')
    },
  })

  if (q.isLoading) return <LoadingState label="Buscando financiamentos…" />
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
  const data = q.data!
  const canSwap = vehicleStatus === 'active'

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle1" fontWeight={800} sx={{ flex: 1 }}>
          Financiamentos
        </Typography>
        <Button size="small" startIcon={<LinkRoundedIcon />} onClick={() => setLinking((v) => !v)}>
          Vincular parcelamento existente
        </Button>
        {canSwap && (
          <Button size="small" variant="contained" startIcon={<SwapHorizRoundedIcon />} onClick={() => setSwapGroup(null)}>
            Troquei este veículo
          </Button>
        )}
      </Stack>

      {linking && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Escolha o parcelamento que financia este veículo. Todas as parcelas (pagas e a pagar)
                passam a apontar para ele.
              </Typography>
              {linkMutation.isError && <ErrorState message={errorMessage(linkMutation.error)} />}
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ flex: 1 }}>
                  <AutocompleteField
                    label="Parcelamento"
                    value={linkGroup}
                    onChange={setLinkGroup}
                    options={linkOptions}
                    size="small"
                  />
                </Box>
                <Button variant="contained" size="small" disabled={!linkGroup || linkMutation.isPending} onClick={() => linkMutation.mutate()}>
                  Vincular
                </Button>
                <Button size="small" color="inherit" onClick={() => setLinking(false)}>
                  Cancelar
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      )}

      {data.debts.length === 0 && (
        <EmptyState
          title="Nenhum financiamento vinculado"
          description="Vincule um parcelamento existente ou registre uma troca de veículo para o contrato aparecer aqui."
        />
      )}

      {data.debts.map((d) => (
        <DebtCard
          key={d.root_group_id}
          debt={d}
          vehicleId={vehicleId}
          onLineage={() => setLineageGroup(d.current_group_id)}
          onPayoff={() => setPayoffGroup(d.current_group_id)}
          onSwap={() => setSwapGroup(d.current_group_id)}
        />
      ))}

      {data.events.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={800}>
            Eventos
          </Typography>
          <EventsTable events={data.events} vehicleId={vehicleId} />
        </Stack>
      )}

      {data.debts.some((d) => !d.settled) && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Ao trocar o veículo, a quitação do contrato costuma sair por menos que o saldo — a
          economia fica registrada como desconto de quitação antecipada.
        </Alert>
      )}

      {lineageGroup && <DebtLineageDialog groupId={lineageGroup} onClose={() => setLineageGroup(null)} />}
      {payoffGroup && <PayoffDialog groupId={payoffGroup} onClose={() => setPayoffGroup(null)} />}
      {swapGroup !== undefined && (
        <AssetSwapDialog
          initialOldVehicleId={vehicleId}
          initialOldGroupId={swapGroup ?? undefined}
          onClose={() => setSwapGroup(undefined)}
        />
      )}
    </Stack>
  )
}
