import { useMemo } from 'react'
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
  alpha,
  useTheme,
} from '@mui/material'
import DirectionsCarRoundedIcon from '@mui/icons-material/DirectionsCarRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import SellRoundedIcon from '@mui/icons-material/SellRounded'
import PauseCircleOutlineRoundedIcon from '@mui/icons-material/PauseCircleOutlineRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listVehiclesPaged, type Vehicle } from '../api'
import { vehicleKeys, VEHICLE_STATUS_COLOR, formatKM, formatMoney } from '../constants'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { PageHeader } from '@/features/health/components/PageHeader'
import { LoadingState, ErrorState, EmptyState } from '@/features/health/components/StateViews'

type SvgIconComponent = React.ElementType

function StatCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string
  value: number
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

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const navigate = useNavigate()
  const theme = useTheme()
  const fuelType = useCatalog('vehicle.fuel_type')
  const vehicleStatus = useCatalog('vehicle.vehicle_status')
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea
        onClick={() => navigate(`/dashboard/frota/veiculos/${vehicle.id}`)}
        sx={{ height: '100%' }}
      >
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.3}>
                {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
              </Typography>
              <Chip
                size="small"
                label={vehicleStatus.labelOf(vehicle.status)}
                color={VEHICLE_STATUS_COLOR[vehicle.status]}
                variant="filled"
              />
            </Stack>

            {vehicle.nickname && (
              <Typography variant="body2" color="text.secondary">
                {vehicle.make} {vehicle.model}
              </Typography>
            )}

            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip
                size="small"
                label={vehicle.year_model}
                variant="outlined"
                sx={{ fontSize: 11 }}
              />
              {vehicle.plate && (
                <Chip size="small" label={vehicle.plate} variant="outlined" sx={{ fontSize: 11 }} />
              )}
              <Chip
                size="small"
                label={fuelType.labelOf(vehicle.fuel_type)}
                variant="outlined"
                sx={{ fontSize: 11 }}
              />
            </Stack>

            <Stack direction="row" alignItems="center" spacing={0.5}>
              <SpeedRoundedIcon fontSize="small" sx={{ color: 'text.disabled', fontSize: 16 }} />
              <Typography variant="caption" color="text.secondary">
                {formatKM(vehicle.current_odometer)}
              </Typography>
              {vehicle.acquisition_price && (
                <>
                  <Typography variant="caption" color="text.disabled" sx={{ mx: 0.5 }}>
                    ·
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Aquisição: {formatMoney(vehicle.acquisition_price)}
                  </Typography>
                </>
              )}
            </Stack>

            <Box
              sx={{
                height: 3,
                borderRadius: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.1),
              }}
            />
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  )
}

export default function VehiclesDashboardPage() {
  const navigate = useNavigate()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: vehicleKeys.list({ limit: 200, offset: 0 }),
    queryFn: () => listVehiclesPaged({ limit: 200, offset: 0 }),
  })

  const vehicles = useMemo(() => data?.items ?? [], [data])

  const stats = useMemo(() => {
    const active = vehicles.filter((v) => v.status === 'active').length
    const sold = vehicles.filter((v) => v.status === 'sold').length
    const inactive = vehicles.filter((v) => v.status === 'inactive').length
    return { total: vehicles.length, active, sold, inactive }
  }, [vehicles])

  return (
    <>
      <PageHeader
        title="Frota Familiar"
        subtitle="Visão geral dos seus veículos, manutenções e valores FIPE."
        action={
          <Button
            variant="contained"
            startIcon={<AddRoundedIcon />}
            onClick={() => navigate('/dashboard/frota/veiculos')}
          >
            Gerenciar veículos
          </Button>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Total de veículos" value={stats.total} icon={DirectionsCarRoundedIcon} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Ativos"
            value={stats.active}
            icon={CheckCircleOutlineRoundedIcon}
            color="#2e7d32"
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard title="Vendidos" value={stats.sold} icon={SellRoundedIcon} color="#ed6c02" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            title="Inativos"
            value={stats.inactive}
            icon={PauseCircleOutlineRoundedIcon}
            color="#757575"
          />
        </Grid>
      </Grid>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message={String(error)} onRetry={refetch} />
      ) : vehicles.length === 0 ? (
        <EmptyState
          icon={<DirectionsCarRoundedIcon />}
          title="Nenhum veículo cadastrado"
          description="Cadastre o primeiro veículo da sua frota."
          action={
            <Button
              variant="contained"
              startIcon={<AddRoundedIcon />}
              onClick={() => navigate('/dashboard/frota/veiculos')}
            >
              Cadastrar veículo
            </Button>
          }
        />
      ) : (
        <>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Sua frota ({vehicles.length})
          </Typography>
          <Grid container spacing={2}>
            {vehicles.map((v) => (
              <Grid key={v.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <VehicleCard vehicle={v} />
              </Grid>
            ))}
          </Grid>
        </>
      )}
    </>
  )
}
