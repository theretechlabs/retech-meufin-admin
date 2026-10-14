import { useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import HomeWorkRoundedIcon from '@mui/icons-material/HomeWorkRounded'
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded'
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getTaxOverview } from '../api'
import {
  errorMessage,
  formatCents,
  formatDate,
  patrimonyKeys,
  TAX_STATUS_COLOR,
} from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { PageHeader } from '@/features/health/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'

type SvgIconComponent = React.ElementType

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  icon: SvgIconComponent
  color?: string
}) {
  const theme = useTheme()
  const c = color ?? theme.palette.primary.main
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h5" fontWeight={800}>
              {value}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: alpha(c, 0.12),
              color: c,
            }}
          >
            <Icon />
          </Box>
        </Stack>
      </CardContent>
    </Card>
  )
}

// Cores estáveis por tipo de imposto para as séries de inflação.
const SERIES_COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#0288d1', '#7b1fa2', '#5d4037']

export default function PatrimonyDashboardPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const taxType = useCatalog('patrimony.tax_type')
  const taxStatus = useCatalog('patrimony.tax_status')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: patrimonyKeys.overview(),
    queryFn: () => getTaxOverview(),
  })

  const currentYear = new Date().getFullYear()

  const yearData = useMemo(
    () =>
      (data?.by_year ?? []).map((y) => ({
        year: String(y.year),
        Previsto: y.planned_cents / 100,
        Pago: y.paid_cents / 100,
      })),
    [data],
  )

  // Pivot da inflação: uma linha por ano, uma coluna por tipo de imposto (variação %).
  const { inflationData, inflationTypes } = useMemo(() => {
    const rows = new Map<number, Record<string, number | string>>()
    const types = new Set<string>()
    for (const inf of data?.inflation ?? []) {
      if (inf.variation_pct == null) continue
      const label = taxType.labelOf(inf.tax_type)
      types.add(label)
      const row = rows.get(inf.year) ?? { year: String(inf.year) }
      row[label] = Number(inf.variation_pct.toFixed(1))
      rows.set(inf.year, row)
    }
    return {
      inflationData: Array.from(rows.entries())
        .sort(([a], [b]) => a - b)
        .map(([, row]) => row),
      inflationTypes: Array.from(types),
    }
  }, [data, taxType])

  const thisYearTotals = useMemo(
    () => (data?.by_year ?? []).find((y) => y.year === currentYear),
    [data, currentYear],
  )

  if (isLoading) {
    return (
      <>
        <PageHeader title="Patrimônio" subtitle="Imóveis e impostos da família." />
        <LoadingState />
      </>
    )
  }
  if (isError) {
    return (
      <>
        <PageHeader title="Patrimônio" subtitle="Imóveis e impostos da família." />
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      </>
    )
  }

  const overview = data!
  const hasData =
    overview.total_properties > 0 || overview.by_year.length > 0 || overview.upcoming.length > 0

  return (
    <>
      <PageHeader
        title="Patrimônio"
        subtitle="Visão geral dos imóveis, impostos e da inflação dos seus bens."
        action={
          <Button
            variant="contained"
            startIcon={<HomeWorkRoundedIcon />}
            onClick={() => navigate('/dashboard/patrimonio/imoveis')}
          >
            Gerenciar imóveis
          </Button>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Imóveis"
            value={String(overview.total_properties)}
            icon={HomeWorkRoundedIcon}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Valor patrimonial"
            value={formatCents(overview.total_property_value)}
            icon={AccountBalanceRoundedIcon}
            color="#2e7d32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title={`Impostos ${currentYear}`}
            value={`${formatCents(thisYearTotals?.paid_cents ?? 0)} / ${formatCents(thisYearTotals?.planned_cents ?? 0)}`}
            icon={RequestQuoteRoundedIcon}
            color="#0288d1"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Vencidos"
            value={String(overview.overdue.length)}
            icon={WarningAmberRoundedIcon}
            color={overview.overdue.length > 0 ? '#d32f2f' : '#757575'}
          />
        </Grid>
      </Grid>

      {!hasData ? (
        <EmptyState
          icon={<HomeWorkRoundedIcon />}
          title="Nada por aqui ainda"
          description="Cadastre imóveis e lance os impostos dos seus bens para ver a evolução e a inflação."
          action={
            <Button
              variant="contained"
              startIcon={<HomeWorkRoundedIcon />}
              onClick={() => navigate('/dashboard/patrimonio/imoveis')}
            >
              Cadastrar imóvel
            </Button>
          }
        />
      ) : (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Evolução anual dos impostos
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total previsto x pago por ano.
                </Typography>
                <Box sx={{ height: 300, mt: 2 }}>
                  {yearData.length === 0 ? (
                    <EmptyState title="Sem lançamentos" description="Cadastre impostos para ver a evolução." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={yearData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                        <XAxis dataKey="year" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
                        <ReTooltip
                          formatter={(v) =>
                            Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                          }
                        />
                        <Legend />
                        <Bar dataKey="Previsto" fill={alpha(theme.palette.primary.main, 0.5)} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Pago" fill={theme.palette.success.main} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Inflação por tipo de imposto
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Variação percentual ano a ano (YoY).
                </Typography>
                <Box sx={{ height: 300, mt: 2 }}>
                  {inflationData.length === 0 ? (
                    <EmptyState
                      title="Sem base de comparação"
                      description="É preciso ao menos dois anos do mesmo imposto para calcular a inflação."
                    />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={inflationData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                        <XAxis dataKey="year" fontSize={12} />
                        <YAxis fontSize={12} tickFormatter={(v) => `${v}%`} />
                        <ReTooltip formatter={(v) => `${Number(v ?? 0)}%`} />
                        <Legend />
                        {inflationTypes.map((label, i) => (
                          <Line
                            key={label}
                            type="monotone"
                            dataKey={label}
                            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" fontWeight={700} gutterBottom>
                  Próximos vencimentos (90 dias)
                </Typography>
                {overview.upcoming.length === 0 && overview.overdue.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    Nenhum imposto a vencer nos próximos 90 dias. Tudo em dia.
                  </Typography>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Tipo</TableCell>
                        <TableCell>Ano</TableCell>
                        <TableCell>Vencimento</TableCell>
                        <TableCell align="right">Valor</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...overview.overdue, ...overview.upcoming].map((t) => (
                        <TableRow key={t.id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{taxType.labelOf(t.tax_type)}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{t.reference_year}</TableCell>
                          <TableCell sx={{ color: 'text.secondary' }}>{formatDate(t.due_date)}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600 }}>
                            {formatCents(t.amount_cents)}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={taxStatus.labelOf(t.status)}
                              color={TAX_STATUS_COLOR[t.status]}
                              variant="filled"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </>
  )
}
