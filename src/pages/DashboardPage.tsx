import {
  alpha,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Skeleton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import PaymentsRoundedIcon from '@mui/icons-material/PaymentsRounded'
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '@/auth/context/jwt/auth-provider'
import { StatCard } from '@/components/common/StatCard'
import { lp } from '@/theme/tokens'
import { BirthdayBoard } from '@/features/health/components/BirthdayBoard'
import {
  centsToReais,
  formatCents,
  getFinanceDashboard,
  getFinanceDashboardMonthly,
} from '@/features/finance/api'

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function MonthlyFlowChart() {
  const theme = useTheme()
  const year = new Date().getFullYear()

  const { data, isLoading } = useQuery({
    queryKey: ['home-dashboard-monthly', year],
    queryFn: () => getFinanceDashboardMonthly({ year }),
    staleTime: 5 * 60 * 1000,
  })

  const chartData = (data?.months ?? []).map((m) => ({
    name: MONTH_LABELS[m.month - 1] ?? String(m.month),
    Receitas: centsToReais(m.income_realized_cents),
    Despesas: centsToReais(m.expense_realized_cents),
    Saldo: centsToReais(m.income_realized_cents - m.expense_realized_cents),
  }))

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={800} sx={{ fontFamily: (t) => t.typography.h6.fontFamily }}>
          Fluxo do mês
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
          Receitas × despesas realizadas em {year}, com o saldo de cada mês.
        </Typography>
        {isLoading ? (
          <Skeleton variant="rounded" height={300} />
        ) : (
          <Box sx={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.08)} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke={theme.palette.text.secondary} />
                <YAxis
                  tick={{ fontSize: 12 }}
                  stroke={theme.palette.text.secondary}
                  tickFormatter={(v: number) =>
                    v >= 1000 || v <= -1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))
                  }
                />
                <Tooltip
                  formatter={(value) =>
                    Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                  }
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 8,
                  }}
                />
                <Legend />
                <Bar dataKey="Receitas" fill={lp.neon} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="Despesas" fill={theme.palette.error.main} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Line type="monotone" dataKey="Saldo" stroke={theme.palette.info.main} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const now = new Date()

  const { data: summary, isLoading } = useQuery({
    queryKey: ['home-dashboard-summary', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => getFinanceDashboard({ year: now.getFullYear(), month: now.getMonth() + 1 }),
    staleTime: 5 * 60 * 1000,
  })

  const incomePct =
    summary && summary.income_expected_cents > 0
      ? (summary.income_realized_cents / summary.income_expected_cents) * 100
      : undefined

  return (
    <Box>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 800,
              fontFamily: (t) => t.typography.h4.fontFamily,
              fontSize: { xs: '1.5rem', sm: '2.125rem' },
            }}
          >
            Olá, {user?.name?.split(' ')[0] ?? 'visitante'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Visão geral das finanças da família em {MONTH_LABELS[now.getMonth()]}/{now.getFullYear()}.
          </Typography>
        </Box>
        <Chip
          label={`A pagar: ${summary ? formatCents(summary.payable_cents) : '—'}`}
          color="primary"
          size="small"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Stack>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 6, md: 4 }}>
          <StatCard
            label="Receitas (mês)"
            value={summary ? formatCents(summary.income_realized_cents) : '—'}
            hint={summary ? `Previsto: ${formatCents(summary.income_expected_cents)}` : 'Carregando...'}
            icon={TrendingUpRoundedIcon}
            progress={incomePct}
            loading={isLoading}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <StatCard
            label="Despesas (mês)"
            value={summary ? formatCents(summary.expense_realized_cents) : '—'}
            hint={summary ? `Previsto: ${formatCents(summary.expense_expected_cents)}` : 'Carregando...'}
            icon={PaymentsRoundedIcon}
            loading={isLoading}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatCard
            label="Saldo (mês)"
            value={summary ? formatCents(summary.balance_realized_cents) : '—'}
            hint={summary ? `Projetado: ${formatCents(summary.balance_expected_cents)}` : 'Carregando...'}
            icon={SavingsRoundedIcon}
            loading={isLoading}
          />
        </Grid>

        <Grid size={12}>
          <MonthlyFlowChart />
        </Grid>

        <Grid size={12}>
          <BirthdayBoard />
        </Grid>
      </Grid>
    </Box>
  )
}
