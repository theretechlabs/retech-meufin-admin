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
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import LinkRoundedIcon from '@mui/icons-material/LinkRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { ConfirmDialog } from '@/features/health/components/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { useToast } from '@/providers/ToastProvider'
import {
  deleteFinancing,
  formatCents,
  getAssetDebts,
  getInstallmentsProjection,
  getSupplier,
  linkInstallmentGroupAsset,
  type AssetType,
  type DebtLineage,
  type FinancingContract,
  type Renegotiation,
} from '../api'
import { errorMessage, financeKeys } from '../constants'
import { formatDateBR, formatOptionalCents, formatRatePPM } from '../financing'
import { AssetSwapDialog } from './AssetSwapDialog'
import { DebtLineageDialog } from './DebtLineageDialog'
import { FinancingContractDialog } from './FinancingContractDialog'
import { FinancingReadjustDialog } from './FinancingReadjustDialog'
import { PayoffDialog } from './PayoffDialog'

/** Próxima parcela em aberto da série vigente. */
function nextOpenInstallment(debt: DebtLineage) {
  const last = debt.stages[debt.stages.length - 1]
  return last?.entries.find((e) => e.status === 'prevista' && e.installment_number != null) ?? null
}

function ContractItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Grid size={{ xs: 6, sm: 3 }}>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={700}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Grid>
  )
}

/** Dados do contrato de financiamento: banco, posição e taxas. */
function ContractDetails({ contract, debt }: { contract: FinancingContract; debt: DebtLineage }) {
  const supplierQ = useQuery({
    queryKey: [...financeKeys.suppliers(), 'by-id', contract.supplier_id] as const,
    queryFn: () => getSupplier(contract.supplier_id!),
    enabled: Boolean(contract.supplier_id),
  })
  const next = nextOpenInstallment(debt)
  return (
    <Box sx={{ p: 1.5, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Grid container spacing={2}>
        <ContractItem
          label="Banco"
          value={supplierQ.data?.name ?? '—'}
          hint={contract.contract_number ? `Contrato ${contract.contract_number}` : undefined}
        />
        <ContractItem
          label="Saldo devedor"
          value={formatOptionalCents(contract.balance_cents)}
          hint={contract.balance_date ? `informado em ${formatDateBR(contract.balance_date)}` : 'não informado'}
        />
        <ContractItem
          label="Próxima prestação"
          value={next ? formatCents(next.amount_cents) : '—'}
          hint={
            next
              ? `${next.installment_number}/${next.installment_total} · vence ${formatDateBR(next.due_date)}`
              : undefined
          }
        />
        <ContractItem
          label="Prazo restante"
          value={`${debt.open_count} meses`}
          hint={`de ${contract.term_months} contratados`}
        />
        <ContractItem label="Valor financiado" value={formatOptionalCents(contract.financed_cents)} />
        <ContractItem label="Entrada" value={formatOptionalCents(contract.down_payment_cents)} />
        <ContractItem label="Juros nominais" value={formatRatePPM(contract.nominal_rate_ppm)} />
        <ContractItem
          label="Juros efetivos"
          value={formatRatePPM(contract.effective_rate_ppm)}
          hint={
            contract.effective_relationship_rate_ppm != null
              ? `${formatRatePPM(contract.effective_relationship_rate_ppm)} com relacionamento`
              : undefined
          }
        />
      </Grid>
    </Box>
  )
}

function DebtCard({
  debt,
  assetId,
  onLineage,
  onPayoff,
  onSwap,
  onEditContract,
  onReadjust,
  onDeleteContract,
}: {
  debt: DebtLineage
  assetId: string
  onLineage: () => void
  onPayoff: () => void
  /** Ausente quando o bem não admite troca (imóvel). */
  onSwap?: () => void
  onEditContract: () => void
  onReadjust: () => void
  onDeleteContract: () => void
}) {
  const pct = debt.current_total_cents > 0 ? Math.min(100, Math.round((debt.paid_cents / debt.current_total_cents) * 100)) : 0
  const closed = debt.closed_by
  const last = debt.stages[debt.stages.length - 1]
  const isSuccessorOfThisAsset = closed?.kind === 'troca_bem' && closed.new_asset_id === assetId
  const contract = debt.contract ?? null

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="subtitle1" fontWeight={800} sx={{ flex: 1 }}>
              {debt.description}
            </Typography>
            {!debt.settled && <Chip size="small" color="primary" label="Vigente" />}
            {contract?.auto_debit && !debt.settled && (
              <Chip size="small" variant="outlined" icon={<AutorenewRoundedIcon />} label="Débito automático" />
            )}
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
            {debt.origin_event && !isSuccessorOfThisAsset && (
              <Chip size="small" variant="outlined" label="Nasceu de uma troca" />
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {last.installment_total}× · {formatDateBR(last.first_due_date)} a {formatDateBR(last.last_due_date)}
          </Typography>

          {contract && <ContractDetails contract={contract} debt={debt} />}

          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Typography variant="caption" color="text.secondary" display="block">
                {contract ? 'Soma das parcelas' : 'Total da dívida'}
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
                {onSwap && (
                  <Button size="small" startIcon={<SwapHorizRoundedIcon />} onClick={onSwap}>
                    Troquei o veículo
                  </Button>
                )}
                {contract && (
                  <Button size="small" startIcon={<TrendingUpRoundedIcon />} onClick={onReadjust}>
                    Reajustar prestação
                  </Button>
                )}
              </>
            )}
            {contract && (
              <>
                <Button size="small" startIcon={<EditRoundedIcon />} onClick={onEditContract}>
                  Editar contrato
                </Button>
                <Button size="small" color="error" startIcon={<DeleteOutlineRoundedIcon />} onClick={onDeleteContract}>
                  Excluir
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  )
}

function EventsTable({ events, assetId }: { events: Renegotiation[]; assetId: string }) {
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
              ev.kind === 'troca_bem' ? (ev.new_asset_id === assetId ? 'entrou nesta troca' : 'saiu nesta troca') : ''
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
 * Aba "Financiamento" de um bem (imóvel ou veículo): os contratos que o
 * financiam — com dados do banco, saldo, progresso e atalhos para reajustar,
 * quitar e renegociar — e os eventos em que ele aparece. É daqui que se
 * registra um financiamento novo; para quem lançou as parcelas antes de
 * existir o contrato, há o atalho de vincular um parcelamento existente.
 */
export function AssetFinanceTab({
  assetType,
  assetId,
  assetName,
  purchaseDate,
  canSwap = false,
}: {
  assetType: AssetType
  assetId: string
  /** Nome do bem: vira a descrição padrão das parcelas. */
  assetName: string
  /** Data de compra/aquisição, quando conhecida: pré-preenche o contrato. */
  purchaseDate?: string | null
  /** Troca de bem financiado: só veículo ativo. */
  canSwap?: boolean
}) {
  const qc = useQueryClient()
  const { show } = useToast()
  const assetNoun = useCatalog('finance.asset_type').labelOf(assetType).toLowerCase()
  const [lineageGroup, setLineageGroup] = useState<string | null>(null)
  const [payoffGroup, setPayoffGroup] = useState<string | null>(null)
  const [swapGroup, setSwapGroup] = useState<string | null | undefined>(undefined) // undefined = fechado
  const [linking, setLinking] = useState(false)
  const [linkGroup, setLinkGroup] = useState('')
  // undefined = fechado; null = contrato novo; contrato = edição.
  const [contractForm, setContractForm] = useState<FinancingContract | null | undefined>(undefined)
  const [readjusting, setReadjusting] = useState<DebtLineage | null>(null)
  const [deleting, setDeleting] = useState<FinancingContract | null>(null)

  const q = useQuery({
    queryKey: financeKeys.assetDebts(assetType, assetId),
    queryFn: () => getAssetDebts(assetType, assetId),
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
    mutationFn: () => linkInstallmentGroupAsset(linkGroup, { asset_type: assetType, asset_id: assetId }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show(`${res.entries_updated} parcela(s) vinculada(s) ao ${assetNoun}.`)
      setLinking(false)
      setLinkGroup('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (contract: FinancingContract) => deleteFinancing(contract.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: financeKeys.all })
      show('Financiamento excluído.')
      setDeleting(null)
    },
  })

  if (q.isLoading) return <LoadingState label="Buscando financiamentos…" />
  if (q.isError) return <ErrorState message={errorMessage(q.error)} onRetry={() => q.refetch()} />
  const data = q.data!

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
          <Button size="small" variant="outlined" startIcon={<SwapHorizRoundedIcon />} onClick={() => setSwapGroup(null)}>
            Troquei este veículo
          </Button>
        )}
        <Button size="small" variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setContractForm(null)}>
          Novo financiamento
        </Button>
      </Stack>

      {linking && (
        <Card variant="outlined">
          <CardContent>
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary">
                Escolha o parcelamento que financia este {assetNoun}. Todas as parcelas (pagas e a pagar)
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
          title="Nenhum financiamento"
          description={`Registre o financiamento deste ${assetNoun}: as parcelas, pagas e a pagar, são geradas de uma vez.`}
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setContractForm(null)}>
              Novo financiamento
            </Button>
          }
        />
      )}

      {data.debts.map((d) => (
        <DebtCard
          key={d.root_group_id}
          debt={d}
          assetId={assetId}
          onLineage={() => setLineageGroup(d.current_group_id)}
          onPayoff={() => setPayoffGroup(d.current_group_id)}
          onSwap={canSwap ? () => setSwapGroup(d.current_group_id) : undefined}
          onEditContract={() => d.contract && setContractForm(d.contract)}
          onReadjust={() => setReadjusting(d)}
          onDeleteContract={() => d.contract && setDeleting(d.contract)}
        />
      ))}

      {data.events.length > 0 && (
        <Stack spacing={1}>
          <Typography variant="subtitle1" fontWeight={800}>
            Eventos
          </Typography>
          <EventsTable events={data.events} assetId={assetId} />
        </Stack>
      )}

      {canSwap && data.debts.some((d) => !d.settled) && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          Ao trocar o veículo, a quitação do contrato costuma sair por menos que o saldo — a
          economia fica registrada como desconto de quitação antecipada.
        </Alert>
      )}

      {lineageGroup && <DebtLineageDialog groupId={lineageGroup} onClose={() => setLineageGroup(null)} />}
      {payoffGroup && <PayoffDialog groupId={payoffGroup} onClose={() => setPayoffGroup(null)} />}
      {swapGroup !== undefined && (
        <AssetSwapDialog
          initialOldVehicleId={assetId}
          initialOldGroupId={swapGroup ?? undefined}
          onClose={() => setSwapGroup(undefined)}
        />
      )}
      {contractForm !== undefined && (
        <FinancingContractDialog
          assetType={assetType}
          assetId={assetId}
          assetName={assetName}
          purchaseDate={purchaseDate}
          contract={contractForm ?? undefined}
          onClose={() => setContractForm(undefined)}
        />
      )}
      {readjusting?.contract && (
        <FinancingReadjustDialog
          contract={readjusting.contract}
          nextDueDate={nextOpenInstallment(readjusting)?.due_date}
          onClose={() => setReadjusting(null)}
        />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir financiamento"
        description={`Excluir "${deleting?.description}"? O contrato e TODAS as parcelas (inclusive as já pagas) serão removidos das despesas. Esta ação não pode ser desfeita.`}
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
        onClose={() => setDeleting(null)}
      />
    </Stack>
  )
}
