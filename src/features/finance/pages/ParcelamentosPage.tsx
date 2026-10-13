import { useMemo, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  Card,
  CardContent,
  Chip,
  Grid,
  InputAdornment,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded'
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded'
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded'
import { DebtLineageDialog } from '../components/DebtLineageDialog'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import { RenameInstallmentGroupDialog } from '../components/RenameInstallmentGroupDialog'
import { RenegotiateDialog } from '../components/RenegotiateDialog'
import { PayoffDialog } from '../components/PayoffDialog'
import { AssetSwapDialog } from '../components/AssetSwapDialog'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded'
import CreditCardRoundedIcon from '@mui/icons-material/CreditCardRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded'
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import {
  formatCents,
  getInstallmentsProjection,
  listCards,
  listCardsIncludingInactive,
} from '../api'
import type { InstallmentGroup, MonthlyCommitment } from '../api'
import { errorMessage, financeKeys, INSTALLMENT_SOURCE_OPTIONS } from '../constants'
import { useExpenseCategories } from '../hooks/useExpenseCategories'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { PageHeader } from '@/features/health/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'

const MONTH_SHORT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/** "2026-08" → "ago/26" */
function monthLabel(ym: string): string {
  const m = Number(ym.slice(5, 7))
  return `${MONTH_SHORT[m - 1] ?? ym}/${ym.slice(2, 4)}`
}

/** "2026-10" deslocado `back` meses para trás. */
function shiftMonth(ym: string, back: number): string {
  const idx = Number(ym.slice(0, 4)) * 12 + (Number(ym.slice(5, 7)) - 1) - back
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`
}

/**
 * Reconstrói o comprometimento mensal a partir dos grupos — as parcelas
 * restantes ocupam meses consecutivos terminando em ends_at (mesma regra
 * da projeção do backend). Usado quando há filtros ativos.
 */
function monthlyFromGroups(groups: InstallmentGroup[]): MonthlyCommitment[] {
  const acc = new Map<string, MonthlyCommitment>()
  for (const g of groups) {
    for (let i = 0; i < g.remaining_count; i++) {
      const month = shiftMonth(g.ends_at, i)
      const cur = acc.get(month) ?? { month, total_cents: 0, count: 0 }
      cur.total_cents += g.installment_cents
      cur.count += 1
      acc.set(month, cur)
    }
  }
  return [...acc.values()].sort((a, b) => a.month.localeCompare(b.month))
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          {icon}
          <Typography variant="overline" color="text.secondary" noWrap>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary">
            {hint}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default function ParcelamentosPage() {
  const theme = useTheme()
  const { activeCategories, labelOf } = useExpenseCategories()
  const [query, setQuery] = useState('')
  const [cardFilter, setCardFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [toRenegotiate, setToRenegotiate] = useState<string | null>(null)
  const [toPayoff, setToPayoff] = useState<string | null>(null)
  const [toSwap, setToSwap] = useState<string | null>(null)
  const [lineageGroup, setLineageGroup] = useState<string | null>(null)
  const [toRename, setToRename] = useState<InstallmentGroup | null>(null)

  const projectionQuery = useQuery({
    queryKey: [...financeKeys.all, 'installments-projection'] as const,
    queryFn: getInstallmentsProjection,
  })
  // Opções do filtro: só cartões ativos. Nome na tabela: todos, porque
  // parcelamentos antigos podem pertencer a cartão já desativado.
  const cardsQuery = useQuery({
    queryKey: financeKeys.cards(),
    queryFn: listCards,
  })
  const allCardsQuery = useQuery({
    queryKey: financeKeys.cardsIncludingInactive(),
    queryFn: listCardsIncludingInactive,
  })

  const cardName = (id?: string | null) =>
    (allCardsQuery.data ?? []).find((c) => c.id === id)?.name ?? '—'

  const proj = projectionQuery.data
  const groups = useMemo(() => proj?.groups ?? [], [proj])

  const hasFilters = Boolean(query.trim() || cardFilter || categoryFilter || sourceFilter)

  const filteredGroups = useMemo(() => {
    const q = query.trim().toLowerCase()
    return groups.filter((g) => {
      if (q && !g.description.toLowerCase().includes(q)) return false
      if (cardFilter && g.card_id !== cardFilter) return false
      if (categoryFilter && g.category !== categoryFilter) return false
      if (sourceFilter && g.source !== sourceFilter) return false
      return true
    })
  }, [groups, query, cardFilter, categoryFilter, sourceFilter])

  // Com filtros, o mensal é reconstruído a partir dos grupos filtrados; sem
  // filtros, usa a projeção do backend direto.
  const monthly = useMemo(
    () =>
      hasFilters ? monthlyFromGroups(filteredGroups) : (proj?.monthly ?? []),
    [hasFilters, filteredGroups, proj],
  )

  const remainingTotalCents = useMemo(
    () =>
      hasFilters
        ? filteredGroups.reduce((sum, g) => sum + g.remaining_cents, 0)
        : (proj?.remaining_total_cents ?? 0),
    [hasFilters, filteredGroups, proj],
  )

  const chartData = useMemo(
    () =>
      monthly.map((m) => ({
        name: monthLabel(m.month),
        valor: m.total_cents / 100,
        parcelas: m.count,
      })),
    [monthly],
  )

  const nextMonth = monthly[0]
  const lastMonth = monthly[monthly.length - 1]

  const clearFilters = () => {
    setQuery('')
    setCardFilter('')
    setCategoryFilter('')
    setSourceFilter('')
  }

  return (
    <>
      <PageHeader
        title="Parcelamentos"
        subtitle="Compromissos parcelados — compras em fatura de cartão (projeção calculada) e despesas parceladas diretas (parcelas previstas reais)."
      />

      {projectionQuery.isLoading ? (
        <LoadingState />
      ) : projectionQuery.isError ? (
        <ErrorState
          message={errorMessage(projectionQuery.error)}
          onRetry={projectionQuery.refetch}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<TimelineRoundedIcon />}
          title="Nenhum parcelamento ativo identificado"
          description="Importe faturas com compras parceladas (ex.: PARC 03/10) ou lance despesas parceladas — o acompanhamento dos meses futuros aparece aqui automaticamente."
        />
      ) : (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 5 }}>
                  <TextField
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por descrição…"
                    size="small"
                    fullWidth
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 3 }}>
                  <AutocompleteField
                    label="Cartão"
                    size="small"
                    emptyLabel="Todos"
                    value={cardFilter}
                    onChange={setCardFilter}
                    options={(cardsQuery.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                  <AutocompleteField
                    label="Categoria"
                    size="small"
                    emptyLabel="Todas"
                    value={categoryFilter}
                    onChange={setCategoryFilter}
                    options={activeCategories.map((cat) => ({
                      value: cat.slug,
                      label: cat.name,
                      description: cat.group_name,
                    }))}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3, md: 2 }}>
                  <AutocompleteField
                    label="Origem"
                    size="small"
                    emptyLabel="Todas"
                    value={sourceFilter}
                    onChange={setSourceFilter}
                    options={INSTALLMENT_SOURCE_OPTIONS}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {filteredGroups.length === 0 ? (
            <EmptyState
              icon={<TimelineRoundedIcon />}
              title="Nenhum parcelamento encontrado"
              description="Nenhum parcelamento corresponde aos filtros. Ajuste a busca ou limpe os filtros."
              action={
                <Button variant="outlined" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              }
            />
          ) : (
            <>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    icon={<PaidRoundedIcon fontSize="small" color="warning" />}
                    label="Comprometido total"
                    value={formatCents(remainingTotalCents)}
                    hint="Parcelas futuras já contratadas"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    icon={
                      <CalendarMonthRoundedIcon
                        fontSize="small"
                        color="warning"
                      />
                    }
                    label="Próximo mês"
                    value={nextMonth ? formatCents(nextMonth.total_cents) : '—'}
                    hint={
                      nextMonth
                        ? `${monthLabel(nextMonth.month)} — ${nextMonth.count} parcela(s)`
                        : undefined
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    icon={
                      <CreditCardRoundedIcon fontSize="small" color="info" />
                    }
                    label="Parcelamentos ativos"
                    value={String(filteredGroups.length)}
                    hint="Em faturas de cartão e despesas parceladas"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <StatCard
                    icon={
                      <TimelineRoundedIcon fontSize="small" color="success" />
                    }
                    label="Livre a partir de"
                    value={lastMonth ? monthLabel(lastMonth.month) : '—'}
                    hint="Mês seguinte à última parcela"
                  />
                </Grid>
              </Grid>

              <Card>
                <CardContent>
                  <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                    Comprometimento mensal futuro
                  </Typography>
                  <Box sx={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={chartData}
                        margin={{ top: 8, right: 24, bottom: 8, left: 8 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={theme.palette.divider}
                        />
                        <XAxis
                          dataKey="name"
                          tick={{
                            fontSize: 12,
                            fill: theme.palette.text.secondary,
                          }}
                          stroke={theme.palette.divider}
                        />
                        <YAxis
                          tick={{
                            fontSize: 12,
                            fill: theme.palette.text.secondary,
                          }}
                          stroke={theme.palette.divider}
                          tickFormatter={(v: number) =>
                            v.toLocaleString('pt-BR', {
                              style: 'currency',
                              currency: 'BRL',
                              maximumFractionDigits: 0,
                            })
                          }
                        />
                        <ReTooltip
                          formatter={(v, name) =>
                            name === 'Comprometido'
                              ? Number(v ?? 0).toLocaleString('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL',
                                })
                              : v
                          }
                          contentStyle={{
                            background: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 8,
                          }}
                        />
                        <Bar
                          dataKey="valor"
                          name="Comprometido"
                          radius={[4, 4, 0, 0]}
                        >
                          {chartData.map((_, i) => (
                            <Cell
                              key={i}
                              fill={alpha(theme.palette.warning.main, 0.85)}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>

              <Card>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Descrição</TableCell>
                        <TableCell>Origem</TableCell>
                        <TableCell>Cartão</TableCell>
                        <TableCell>Categoria</TableCell>
                        <TableCell sx={{ minWidth: 180 }}>Progresso</TableCell>
                        <TableCell align="right">Parcela</TableCell>
                        <TableCell align="right">Restante</TableCell>
                        <TableCell>Termina em</TableCell>
                        <TableCell align="right">Ações</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredGroups.map((g, i) => {
                        const pct = Math.round(
                          (g.last_known_number / g.installment_total) * 100,
                        )
                        return (
                          <TableRow key={i} hover>
                            <TableCell sx={{ fontWeight: 600 }}>
                              {g.description}
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                variant="outlined"
                                color={g.source === 'expense' ? 'info' : 'default'}
                                label={g.source === 'expense' ? 'Despesa' : 'Fatura'}
                              />
                            </TableCell>
                            <TableCell>{cardName(g.card_id)}</TableCell>
                            <TableCell>
                              {g.category ? labelOf(g.category) : '—'}
                            </TableCell>
                            <TableCell>
                              <Tooltip title={`${pct}% pago`}>
                                <Stack
                                  direction="row"
                                  spacing={1}
                                  alignItems="center"
                                >
                                  <LinearProgress
                                    variant="determinate"
                                    value={pct}
                                    color={pct >= 70 ? 'success' : 'warning'}
                                    sx={{ flex: 1, height: 8, borderRadius: 4 }}
                                  />
                                  <Typography
                                    variant="caption"
                                    sx={{ fontWeight: 700, minWidth: 44 }}
                                  >
                                    {g.last_known_number}/{g.installment_total}
                                  </Typography>
                                </Stack>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">
                              {formatCents(g.installment_cents)}
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700 }}>
                              {formatCents(g.remaining_cents)}
                              <Typography
                                variant="caption"
                                display="block"
                                color="text.secondary"
                              >
                                {g.remaining_count}x de{' '}
                                {formatCents(g.installment_cents)}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                variant="outlined"
                                label={monthLabel(g.ends_at)}
                              />
                            </TableCell>
                            <TableCell align="right">
                              {/* Compras em fatura são projeção calculada, sem
                                  lançamentos futuros no banco — não há o que
                                  renomear nem repactuar. */}
                              {g.group_id && (
                                <>
                                  <Tooltip title="Renomear parcelamento">
                                    <IconButton size="small" onClick={() => setToRename(g)}>
                                      <EditRoundedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Renegociar dívida">
                                    <IconButton
                                      size="small"
                                      onClick={() => setToRenegotiate(g.group_id as string)}
                                    >
                                      <HandshakeRoundedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Quitar contrato (antecipado)">
                                    <IconButton
                                      size="small"
                                      onClick={() => setToPayoff(g.group_id as string)}
                                    >
                                      <CheckCircleRoundedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Troca de veículo (dado como entrada)">
                                    <IconButton
                                      size="small"
                                      onClick={() => setToSwap(g.group_id as string)}
                                    >
                                      <SwapHorizRoundedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                  <Tooltip title="Histórico da dívida">
                                    <IconButton
                                      size="small"
                                      onClick={() => setLineageGroup(g.group_id as string)}
                                    >
                                      <AccountTreeRoundedIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </>
          )}
        </Stack>
      )}

      {toRenegotiate && (
        <RenegotiateDialog
          groupId={toRenegotiate}
          onClose={() => setToRenegotiate(null)}
        />
      )}

      {toRename && (
        <RenameInstallmentGroupDialog group={toRename} onClose={() => setToRename(null)} />
      )}

      {toPayoff && <PayoffDialog groupId={toPayoff} onClose={() => setToPayoff(null)} />}

      {toSwap && <AssetSwapDialog initialOldGroupId={toSwap} onClose={() => setToSwap(null)} />}

      {lineageGroup && <DebtLineageDialog groupId={lineageGroup} onClose={() => setLineageGroup(null)} />}
    </>
  )
}
