import { useMemo, useState } from 'react'
import {
  alpha,
  Box,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  InputAdornment,
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
  useTheme,
} from '@mui/material'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  formatCents,
  getFiscalDashboard,
  getFiscalInflation,
  getFiscalPriceHistory,
  listFiscalProducts,
  type FiscalProduct,
  type FiscalProductSort,
} from '../api'
import { errorMessage } from '../constants'
import { PageHeader } from '@/features/health/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { AutocompleteField } from '@/components/fields/AutocompleteField'

// Chaves de query locais (constants.ts é somente-leitura para esta feature).
const fiscalKeys = {
  all: ['finance', 'fiscal'] as const,
  dashboard: () => [...fiscalKeys.all, 'dashboard'] as const,
  inflation: () => [...fiscalKeys.all, 'inflation'] as const,
  products: (params: Record<string, unknown>) => [...fiscalKeys.all, 'products', params] as const,
  priceHistory: (name: string) => [...fiscalKeys.all, 'price-history', name] as const,
}

/** Formata quantidade em milésimos como número pt-BR (1000 -> "1", 455 -> "0,455"). */
function formatQty(milli: number): string {
  return (milli / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

/** Rótulo curto de mês YYYY-MM para os eixos (ex.: "2026-07" -> "jul/26"). */
const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function monthLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const idx = Number(m) - 1
  if (idx < 0 || idx > 11) return ym
  return `${MONTH_SHORT[idx]}/${y.slice(2)}`
}

/** Data-calendário 'YYYY-MM-DD' -> 'DD/MM/AAAA' (sem sofrer com fuso). */
function formatDayBR(iso?: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso
}

const SORT_OPTIONS: { value: FiscalProductSort; label: string }[] = [
  { value: 'frequency', label: 'Mais comprados' },
  { value: 'spend', label: 'Maior gasto' },
  { value: 'inflation', label: 'Maior inflação' },
]

function StatCard({
  title,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  title: string
  value: string
  icon: typeof ReceiptLongRoundedIcon
  tone?: 'primary' | 'success' | 'error' | 'warning' | 'info'
}) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary" fontWeight={600} noWrap>
              {title}
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, whiteSpace: 'nowrap' }}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 44,
              height: 44,
              flexShrink: 0,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette[tone].main, t.palette.mode === 'dark' ? 0.18 : 0.12),
              color: `${tone}.main`,
            }}
          >
            <Icon fontSize="small" />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

/** Chip de variação % com cor semântica: subiu = vermelho, caiu = verde. */
function VariationChip({ pct }: { pct: number }) {
  const up = pct > 0.05
  const down = pct < -0.05
  const color: 'error' | 'success' | 'default' = up ? 'error' : down ? 'success' : 'default'
  const sign = pct > 0 ? '+' : ''
  return (
    <Chip
      size="small"
      color={color}
      variant={color === 'default' ? 'outlined' : 'filled'}
      icon={up ? <TrendingUpRoundedIcon /> : down ? <TrendingDownRoundedIcon /> : undefined}
      label={`${sign}${pct.toFixed(1)}%`}
      sx={{ fontWeight: 700 }}
    />
  )
}

export default function FiscalDashboardPage() {
  const theme = useTheme()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<FiscalProductSort>('frequency')
  const [selected, setSelected] = useState<FiscalProduct | null>(null)

  const summaryQ = useQuery({
    queryKey: fiscalKeys.dashboard(),
    queryFn: getFiscalDashboard,
  })
  const inflationQ = useQuery({
    queryKey: fiscalKeys.inflation(),
    queryFn: getFiscalInflation,
  })
  const productsQ = useQuery({
    queryKey: fiscalKeys.products({ q, sort }),
    queryFn: () => listFiscalProducts({ q: q || undefined, sort, limit: 100 }),
  })
  const historyQ = useQuery({
    queryKey: fiscalKeys.priceHistory(`${selected?.name ?? ''}|${selected?.unit ?? ''}`),
    queryFn: () => getFiscalPriceHistory(selected!.name, selected!.unit),
    enabled: Boolean(selected),
  })

  const s = summaryQ.data

  const inflationData = useMemo(
    () =>
      (inflationQ.data?.points ?? []).map((p) => ({
        name: monthLabel(p.month),
        indice: Number(p.index.toFixed(2)),
        variacao: Number(p.monthly_pct.toFixed(2)),
        matched: p.matched_products,
      })),
    [inflationQ.data]
  )

  const spendData = useMemo(
    () =>
      (s?.monthly_spend ?? []).map((m) => ({
        name: monthLabel(m.month),
        valor: m.total_cents / 100,
        items: m.items,
      })),
    [s]
  )

  const historyData = useMemo(
    () =>
      (historyQ.data?.purchases ?? []).map((p) => ({
        name: p.purchase_date,
        preco: p.unit_cents / 100,
        unit_cents: p.unit_cents,
        quantity_milli: p.quantity_milli,
        amount_cents: p.amount_cents,
        document_name: p.document_name,
      })),
    [historyQ.data]
  )

  const brl0 = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  const tooltipStyle = {
    background: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 8,
  }

  const variation12m = inflationQ.data?.variation_12m ?? 0

  return (
    <>
      <PageHeader
        title="Dashboard Fiscal"
        subtitle="Histórico de preço e inflação pessoal por produto, a partir dos cupons e notas fiscais importados."
      />

      {summaryQ.isLoading ? (
        <LoadingState />
      ) : summaryQ.isError ? (
        <ErrorState message={errorMessage(summaryQ.error)} onRetry={summaryQ.refetch} />
      ) : (s?.items ?? 0) === 0 ? (
        <EmptyState
          title="Nenhum item fiscal ainda"
          description="Importe cupons/notas fiscais e vincule-os às despesas para ver o histórico de preços e a inflação pessoal."
        />
      ) : (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Documentos fiscais"
              value={String(s?.documents ?? 0)}
              icon={ReceiptLongRoundedIcon}
              tone="info"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Itens comprados"
              value={String(s?.items ?? 0)}
              icon={Inventory2RoundedIcon}
              tone="primary"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Total gasto"
              value={formatCents(s?.total_cents ?? 0)}
              icon={PaymentsRoundedIcon}
              tone="error"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              title="Produtos distintos"
              value={String(s?.products_count ?? 0)}
              icon={CategoryRoundedIcon}
              tone="success"
            />
          </Grid>

          {/* Inflação pessoal acumulada */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Typography variant="h6" fontWeight={800}>
                      Inflação pessoal
                    </Typography>
                    {inflationQ.data?.methodology && (
                      <Tooltip title={inflationQ.data.methodology}>
                        <InfoOutlinedIcon fontSize="small" color="disabled" />
                      </Tooltip>
                    )}
                  </Stack>
                  <Chip
                    size="small"
                    color={variation12m > 0.05 ? 'error' : variation12m < -0.05 ? 'success' : 'default'}
                    variant={Math.abs(variation12m) <= 0.05 ? 'outlined' : 'filled'}
                    label={`12 meses: ${variation12m > 0 ? '+' : ''}${variation12m.toFixed(1)}%`}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
                {inflationQ.isLoading ? (
                  <LoadingState />
                ) : inflationQ.isError ? (
                  <ErrorState message={errorMessage(inflationQ.error)} onRetry={inflationQ.refetch} />
                ) : inflationData.length === 0 ? (
                  <EmptyState
                    title="Sem histórico suficiente"
                    description="A inflação pessoal precisa de produtos comprados em meses diferentes."
                  />
                ) : (
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={inflationData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                          stroke={theme.palette.divider}
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                          stroke={theme.palette.divider}
                          domain={['auto', 'auto']}
                          width={54}
                        />
                        <ReTooltip
                          contentStyle={tooltipStyle}
                          formatter={(value, name) => {
                            if (name === 'indice')
                              return [Number(value).toFixed(2), 'Índice (base 100)']
                            return [String(value), String(name)]
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="indice"
                          name="indice"
                          stroke={theme.palette.primary.main}
                          strokeWidth={2.5}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Índice base 100 no mês mais antigo. Sobe quando a cesta de produtos recorrentes fica mais cara.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Gasto fiscal por mês */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 2 }}>
                  Gasto fiscal por mês
                </Typography>
                <Box sx={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={spendData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                        stroke={theme.palette.divider}
                      />
                      <YAxis
                        tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                        stroke={theme.palette.divider}
                        tickFormatter={(v: number) => brl0(v)}
                        width={80}
                      />
                      <ReTooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [brl0(Number(v ?? 0)), 'Gasto']}
                      />
                      <Bar
                        dataKey="valor"
                        name="Gasto"
                        fill={theme.palette.primary.main}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Tabela de produtos */}
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                  sx={{ mb: 2 }}
                >
                  <Typography variant="h6" fontWeight={800}>
                    Produtos
                  </Typography>
                  <Stack direction="row" spacing={1.5}>
                    <TextField
                      size="small"
                      placeholder="Buscar produto..."
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchRoundedIcon fontSize="small" />
                            </InputAdornment>
                          ),
                        },
                      }}
                      sx={{ minWidth: 220 }}
                    />
                    <AutocompleteField
                      label="Ordenar"
                      size="small"
                      fullWidth={false}
                      sx={{ minWidth: 200 }}
                      value={sort}
                      onChange={(v) => setSort(v as FiscalProductSort)}
                      options={SORT_OPTIONS}
                      disableClearable
                    />
                  </Stack>
                </Stack>

                {productsQ.isLoading ? (
                  <LoadingState />
                ) : productsQ.isError ? (
                  <ErrorState message={errorMessage(productsQ.error)} onRetry={productsQ.refetch} />
                ) : (productsQ.data?.products.length ?? 0) === 0 ? (
                  <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca e tente de novo." />
                ) : (
                  <TableContainer sx={{ overflowX: 'auto' }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Produto</TableCell>
                          <TableCell align="right">Compras</TableCell>
                          <TableCell align="right">Total</TableCell>
                          <TableCell align="right">Preço médio</TableCell>
                          <TableCell align="right">1º preço</TableCell>
                          <TableCell align="right">Último preço</TableCell>
                          <TableCell align="right">Variação</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(productsQ.data?.products ?? []).map((p) => (
                          <TableRow
                            key={`${p.name}|${p.unit}`}
                            hover
                            onClick={() => setSelected(p)}
                            sx={{ cursor: 'pointer' }}
                          >
                            <TableCell sx={{ fontWeight: 600 }}>
                              <span style={{ textTransform: 'capitalize' }}>{p.name}</span>
                              {p.unit && (
                                <Typography component="span" variant="caption" color="text.secondary">
                                  {' · R$/'}
                                  {p.unit.toLowerCase()}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell align="right">{p.purchases}</TableCell>
                            <TableCell align="right">{formatCents(p.total_cents)}</TableCell>
                            <TableCell align="right">{formatCents(p.avg_unit_cents)}</TableCell>
                            <TableCell align="right">{formatCents(p.first_unit_cents)}</TableCell>
                            <TableCell align="right">{formatCents(p.last_unit_cents)}</TableCell>
                            <TableCell align="right">
                              <VariationChip pct={p.variation_pct} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Dialog: histórico de preço do produto */}
      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={800}>
              <span style={{ textTransform: 'capitalize' }}>{selected?.name}</span>
              {selected?.unit && (
                <Typography component="span" variant="subtitle2" color="text.secondary" sx={{ ml: 1 }}>
                  R$/{selected.unit.toLowerCase()}
                </Typography>
              )}
            </Typography>
            {selected && <VariationChip pct={selected.variation_pct} />}
          </Stack>
          <IconButton
            onClick={() => setSelected(null)}
            sx={{ position: 'absolute', right: 8, top: 8 }}
            size="small"
          >
            <CloseRoundedIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {historyQ.isLoading ? (
            <LoadingState />
          ) : historyQ.isError ? (
            <ErrorState message={errorMessage(historyQ.error)} onRetry={historyQ.refetch} />
          ) : historyData.length === 0 ? (
            <EmptyState title="Sem compras" description="Nenhuma compra encontrada para este produto." />
          ) : (
            <Stack spacing={3}>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historyData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis
                      dataKey="name"
                      tickFormatter={(v: string) => monthLabel(String(v).slice(0, 7))}
                      tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
                      stroke={theme.palette.divider}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                      stroke={theme.palette.divider}
                      tickFormatter={(v: number) => brl0(v)}
                      width={80}
                    />
                    <ReTooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, _name, item) => {
                        const payload = item?.payload as
                          | { quantity_milli: number; amount_cents: number; document_name: string }
                          | undefined
                        const lines = [`Preço unit.: ${formatCents(Math.round(Number(value) * 100))}`]
                        if (payload) {
                          lines.push(`Qtd.: ${formatQty(payload.quantity_milli)}`)
                          lines.push(`Total: ${formatCents(payload.amount_cents)}`)
                        }
                        return [lines.join(' · '), '']
                      }}
                      labelFormatter={(label) => `Compra em ${formatDayBR(String(label))}`}
                    />
                    <Line
                      type="monotone"
                      dataKey="preco"
                      name="Preço unitário"
                      stroke={theme.palette.primary.main}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>

              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Data</TableCell>
                      <TableCell align="right">Preço unit.</TableCell>
                      <TableCell align="right">Qtd.</TableCell>
                      <TableCell align="right">Total</TableCell>
                      <TableCell>Documento</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(historyQ.data?.purchases ?? []).map((p, i) => (
                      <TableRow key={`${p.document_id}-${i}`}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDayBR(p.purchase_date)}</TableCell>
                        <TableCell align="right">{formatCents(p.unit_cents)}</TableCell>
                        <TableCell align="right">{formatQty(p.quantity_milli)}</TableCell>
                        <TableCell align="right">{formatCents(p.amount_cents)}</TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 220,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {p.document_name || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
