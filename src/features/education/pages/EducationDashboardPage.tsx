import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Link,
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
import PaidRoundedIcon from '@mui/icons-material/PaidRounded'
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import SavingsRoundedIcon from '@mui/icons-material/SavingsRounded'
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Legend,
  ResponsiveContainer,
  Tooltip as ReTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getEducationDashboard, type ItemCategory } from '../api'
import {
  CURRENT_YEAR,
  educationKeys,
  errorMessage,
  formatCents,
  formatPct,
  ITEM_CATEGORY_LABEL,
} from '../constants'
import { PageHeader } from '@/features/health/components/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/features/health/components/StateViews'
import { AutocompleteField } from '@/components/fields/AutocompleteField'
import { numericOptions } from '@/components/fields/options'
import { useSchoolYears } from '../hooks/useSchoolYears'


type SvgIconComponent = React.ElementType

function StatCard({
  title,
  value,
  caption,
  icon: Icon,
  color,
}: {
  title: string
  value: string
  caption?: string
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
            {caption && (
              <Typography variant="caption" color="text.secondary">
                {caption}
              </Typography>
            )}
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

/** Reais (não centavos) para os eixos dos gráficos. */
function centsToReaisNum(cents: number): number {
  return Math.round(cents / 100)
}

export default function EducationDashboardPage() {
  const theme = useTheme()
  const navigate = useNavigate()
  const [year, setYear] = useState<number>(CURRENT_YEAR)
  const years = useSchoolYears()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: educationKeys.dashboard(year),
    queryFn: () => getEducationDashboard(year),
  })

  const memberChart = useMemo(
    () =>
      (data?.by_member ?? []).map((m) => ({
        name: m.member_name || 'Sem nome',
        pago: centsToReaisNum(m.total_paid_cents),
      })),
    [data],
  )

  const annualChart = useMemo(
    () =>
      (data?.annual_evolution ?? []).map((y) => ({
        ano: String(y.school_year),
        material: centsToReaisNum(y.supplies_paid_cents),
        mensalidades: centsToReaisNum(y.monthly_fees_cents),
        total: centsToReaisNum(y.total_cents),
      })),
    [data],
  )

  const totalYearCents = (data?.monthly_fees_cents ?? 0) * 12 + (data?.enrollment_fees_cents ?? 0) + (data?.total_paid_cents ?? 0)

  return (
    <>
      <PageHeader
        title="Educação"
        subtitle="Material escolar, mensalidades e economia por ano letivo."
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => navigate('/dashboard/educacao/matriculas')}>
              Matrículas
            </Button>
            <Button variant="contained" onClick={() => navigate('/dashboard/educacao/listas')}>
              Listas de material
            </Button>
          </Stack>
        }
      />

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <AutocompleteField
          label="Ano letivo"
          size="small"
          value={String(year)}
          onChange={(v) => setYear(Number(v))}
          options={numericOptions(years)}
          disableClearable
          fullWidth={false}
          sx={{ minWidth: 150 }}
        />
      </Stack>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={refetch} />
      ) : !data || data.item_count === 0 ? (
        <EmptyState
          icon={<SchoolRoundedIcon />}
          title="Sem dados de educação neste ano"
          description="Cadastre matrículas e listas de material para ver os indicadores."
          action={
            <Button variant="contained" onClick={() => navigate('/dashboard/educacao/matriculas')}>
              Ir para matrículas
            </Button>
          }
        />
      ) : (
        <>
          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Gasto total no ano"
                value={formatCents(totalYearCents)}
                caption="mensalidades + matrículas + material"
                icon={PaidRoundedIcon}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Listas de material"
                value={String(data.list_count)}
                caption={`${data.item_count} itens no total`}
                icon={ListAltRoundedIcon}
                color="#0288d1"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Itens comprados"
                value={formatPct(data.purchased_pct)}
                caption={`${data.purchased_count} de ${data.item_count}`}
                icon={CheckCircleOutlineRoundedIcon}
                color="#2e7d32"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <StatCard
                title={data.savings_cents >= 0 ? 'Economia vs referência' : 'Estouro vs referência'}
                value={formatCents(Math.abs(data.savings_cents))}
                caption={`${formatPct(Math.abs(data.savings_pct))} sobre o pesquisado`}
                icon={SavingsRoundedIcon}
                color={data.savings_cents >= 0 ? '#2e7d32' : '#d32f2f'}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Gasto com material por membro
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={memberChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ReTooltip
                          formatter={(v) => formatCents(Number(v ?? 0) * 100)}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Bar dataKey="pago" name="Pago" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Evolução anual do gasto com educação
                  </Typography>
                  <Box sx={{ height: 300 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={annualChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                        <XAxis dataKey="ano" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <ReTooltip
                          formatter={(v) => formatCents(Number(v ?? 0) * 100)}
                          contentStyle={{ fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="total" name="Total" stroke={theme.palette.primary.main} strokeWidth={2} />
                        <Line type="monotone" dataKey="mensalidades" name="Mensalidades" stroke="#0288d1" strokeWidth={2} />
                        <Line type="monotone" dataKey="material" name="Material" stroke="#ed6c02" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Custo médio por item por categoria
                  </Typography>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Categoria</TableCell>
                        <TableCell align="right">Itens</TableCell>
                        <TableCell align="right">Comprados</TableCell>
                        <TableCell align="right">Total pago</TableCell>
                        <TableCell align="right">Custo médio/item</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.by_category.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5}>
                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                              Nenhum item comprado ainda.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        data.by_category.map((ca) => (
                          <TableRow key={ca.category} hover>
                            <TableCell>
                              {ITEM_CATEGORY_LABEL[ca.category as ItemCategory] ?? ca.category}
                            </TableCell>
                            <TableCell align="right">{ca.item_count}</TableCell>
                            <TableCell align="right">{ca.purchased_count}</TableCell>
                            <TableCell align="right">{formatCents(ca.total_paid_cents)}</TableCell>
                            <TableCell align="right">{formatCents(ca.avg_paid_cents)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 3 }}>
            Os preços de referência são preenchidos manualmente. Não há API pública estável de preços
            de material escolar; como apoio, consulte a pesquisa anual de preços do{' '}
            <Link href="https://www.procon.sp.gov.br" target="_blank" rel="noopener">
              Procon-SP
            </Link>
            . Integração automática de preços é um item de roadmap.
          </Alert>
        </>
      )}
    </>
  )
}
