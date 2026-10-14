import { useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { getHomeSafetyDashboard, type HomeSafetyItem, type HomeSafetyStatus } from '../api'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import {
  CATEGORY_COLOR,
  STATUS_COLOR,
  errorMessage,
  formatCents,
  formatDate,
  formatDaysUntil,
  homeSafetyKeys,
} from '../constants'
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
  value: number | string
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
            <Typography variant="h4" fontWeight={800}>
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

function DueRow({ item, danger }: { item: HomeSafetyItem; danger?: boolean }) {
  const theme = useTheme()
  const category = useCatalog('homesafety.category')
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={1}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1,
        bgcolor: danger ? alpha(theme.palette.error.main, 0.08) : 'transparent',
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {item.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {category.labelOf(item.category)}
          {item.location ? ` · ${item.location}` : ''} · vencimento {formatDate(item.next_due_date)}
        </Typography>
      </Box>
      <Chip
        size="small"
        label={formatDaysUntil(item.days_until_due)}
        color={STATUS_COLOR[item.status]}
        variant={danger ? 'filled' : 'outlined'}
      />
    </Stack>
  )
}

export default function HomeSafetyDashboardPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const category = useCatalog('homesafety.category')
  const status = useCatalog('homesafety.status')

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: homeSafetyKeys.dashboard(),
    queryFn: getHomeSafetyDashboard,
  })

  const statusMap = useMemo(() => {
    const m: Partial<Record<HomeSafetyStatus, number>> = {}
    data?.status_counts.forEach((s) => {
      m[s.status] = s.count
    })
    return m
  }, [data])

  const categoryChart = useMemo(
    () =>
      (data?.by_category ?? []).map((c) => ({
        name: category.labelOf(c.category),
        value: c.count,
        color: CATEGORY_COLOR[c.category],
      })),
    [data, category],
  )

  const costChart = useMemo(
    () =>
      (data?.cost_by_year ?? []).map((c) => ({
        name: String(c.year),
        total: c.cost_cents / 100,
      })),
    [data],
  )

  const goToItems = (status?: string) =>
    navigate(status ? `/dashboard/seguranca-lar/itens?status=${status}` : '/dashboard/seguranca-lar/itens')

  return (
    <>
      <PageHeader
        title="Segurança do Lar"
        subtitle="Controle de validade e manutenção dos itens de segurança da casa."
        action={
          <Button variant="contained" startIcon={<SettingsRoundedIcon />} onClick={() => goToItems()}>
            Gerenciar itens
          </Button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data || data.total_items === 0 ? (
        <EmptyState
          icon={<ShieldRoundedIcon />}
          title="Nenhum item cadastrado"
          description="Cadastre os itens de segurança da sua casa ou adicione a partir do catálogo sugerido."
          action={
            <Button variant="contained" startIcon={<SettingsRoundedIcon />} onClick={() => goToItems()}>
              Começar
            </Button>
          }
        />
      ) : (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Vencidos"
                value={statusMap.vencido ?? 0}
                icon={ReportProblemRoundedIcon}
                color={theme.palette.error.main}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Atenção (30 dias)"
                value={statusMap.atencao ?? 0}
                icon={WarningAmberRoundedIcon}
                color={theme.palette.warning.main}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Próximos (90 dias)"
                value={statusMap.proximo ?? 0}
                icon={ScheduleRoundedIcon}
                color={theme.palette.info.main}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Em dia"
                value={statusMap.ok ?? 0}
                icon={CheckCircleOutlineRoundedIcon}
                color={theme.palette.success.main}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard title="Total de itens" value={data.total_items} icon={ShieldRoundedIcon} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Sem controle"
                value={statusMap.sem_controle ?? 0}
                icon={ScheduleRoundedIcon}
                color={theme.palette.text.disabled}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 6 }}>
              <StatCard
                title="Custo de manutenção (12 meses)"
                value={formatCents(data.annual_cost_cents)}
                icon={PaymentsRoundedIcon}
                color={theme.palette.secondary.main}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            {/* Itens vencidos */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <ReportProblemRoundedIcon color="error" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Itens vencidos
                    </Typography>
                    <Chip size="small" color="error" label={data.overdue.length} sx={{ ml: 'auto' }} />
                  </Stack>
                  <Divider sx={{ mb: 1 }} />
                  {data.overdue.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      Nenhum item vencido. Tudo em ordem!
                    </Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {data.overdue.map((it) => (
                        <DueRow key={it.id} item={it} danger />
                      ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Próximos vencimentos */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <ScheduleRoundedIcon color="info" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={700}>
                      Próximos vencimentos (90 dias)
                    </Typography>
                  </Stack>
                  <Divider sx={{ mb: 1 }} />
                  {data.due_next_90.filter((it) => it.status !== 'vencido').length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                      Nada previsto para os próximos 90 dias.
                    </Typography>
                  ) : (
                    <Stack spacing={0.5}>
                      {data.due_next_90
                        .filter((it) => it.status !== 'vencido')
                        .map((it) => (
                          <DueRow key={it.id} item={it} />
                        ))}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </Grid>

            {/* Distribuição por categoria */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    Distribuição por categoria
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChart}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={(entry) => `${entry.name}: ${entry.value}`}
                        >
                          {categoryChart.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <ReTooltip
                          contentStyle={{
                            background: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 8,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            {/* Custo de manutenção por ano */}
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
                    Custo de manutenção por ano
                  </Typography>
                  {costChart.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                      Ainda não há custos registrados. Adicione manutenções com valor no histórico dos itens.
                    </Typography>
                  ) : (
                    <Box sx={{ height: 300 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={costChart} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                          <XAxis
                            dataKey="name"
                            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                            stroke={theme.palette.divider}
                          />
                          <YAxis
                            tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                            stroke={theme.palette.divider}
                            tickFormatter={(v: number) =>
                              v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
                            }
                            width={90}
                          />
                          <ReTooltip
                            formatter={(v) =>
                              Number(v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                            }
                            contentStyle={{
                              background: theme.palette.background.paper,
                              border: `1px solid ${theme.palette.divider}`,
                              borderRadius: 8,
                            }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar
                            dataKey="total"
                            name="Custo de manutenção"
                            fill={alpha(theme.palette.secondary.main, 0.85)}
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {(['vencido', 'atencao', 'proximo', 'ok', 'sem_controle'] as HomeSafetyStatus[]).map((st) => (
              <Chip
                key={st}
                label={`${status.labelOf(st)}: ${statusMap[st] ?? 0}`}
                color={STATUS_COLOR[st]}
                variant="outlined"
                onClick={() => goToItems(st)}
              />
            ))}
          </Box>
        </>
      )}
    </>
  )
}
