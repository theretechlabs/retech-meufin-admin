import {
  alpha,
  Avatar,
  Box,
  Card,
  CardContent,
  Chip,
  Stack,
  Typography,
} from '@mui/material'
import CakeRoundedIcon from '@mui/icons-material/CakeRounded'
import { useQuery } from '@tanstack/react-query'
import { fetchBirthdays, type Birthday } from '../api'
import { useCatalog } from '@/lib/catalogs/useCatalog'
import { healthKeys } from '../constants'

/** Iniciais (até 2) a partir do nome completo. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** "YYYY-MM-DD" → "12 de julho". */
const MONTHS_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
function formatDayMonth(iso: string): string {
  const [, m, d] = iso.split('-')
  const month = MONTHS_PT[Number(m) - 1]
  if (!month || !d) return iso
  return `${Number(d)} de ${month}`
}

/** Cor determinística do avatar a partir do id (paleta suave). */
const AVATAR_HUES = [210, 340, 160, 32, 265, 12, 190]
function avatarHue(id: string): number {
  let sum = 0
  for (let i = 0; i < id.length; i++) sum += id.charCodeAt(i)
  return AVATAR_HUES[sum % AVATAR_HUES.length]
}

/** Rótulo curto da contagem regressiva. */
function daysLabel(days: number): string {
  if (days <= 0) return 'hoje!'
  if (days === 1) return 'amanhã'
  return `em ${days} dias`
}

function BirthdayRow({ b }: { b: Birthday }) {
  const relationship = useCatalog('health.relationship')
  const isToday = b.days_until <= 0
  const hue = avatarHue(b.id)
  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        py: 1,
        px: 1,
        borderRadius: 2,
        transition: 'background-color .15s',
        bgcolor: (t) =>
          isToday ? alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.16 : 0.12) : 'transparent',
        '&:hover': {
          bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.1 : 0.06),
        },
      }}
    >
      <Avatar
        src={b.avatar_url ?? undefined}
        sx={{
          width: 42,
          height: 42,
          fontSize: '0.9rem',
          fontWeight: 800,
          bgcolor: (t) => alpha(`hsl(${hue}, 70%, 50%)`, t.palette.mode === 'dark' ? 0.28 : 0.18),
          color: (t) => `hsl(${hue}, 70%, ${t.palette.mode === 'dark' ? '68%' : '38%'})`,
        }}
      >
        {initials(b.full_name)}
      </Avatar>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {b.full_name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
          {relationship.labelOf(b.relationship)} · {formatDayMonth(b.next_birthday)}
          {' · '}faz {b.turns} anos
        </Typography>
      </Box>
      <Chip
        size="small"
        label={daysLabel(b.days_until)}
        color={isToday ? 'warning' : 'default'}
        variant={isToday ? 'filled' : 'outlined'}
        sx={{ fontWeight: 700, flexShrink: 0 }}
      />
    </Stack>
  )
}

export function BirthdayBoard({ limit = 6 }: { limit?: number }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: healthKeys.birthdays(),
    queryFn: fetchBirthdays,
    staleTime: 5 * 60 * 1000,
  })

  const items = (data ?? []).slice(0, limit)

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.12),
              color: 'primary.main',
            }}
          >
            <CakeRoundedIcon />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={800} sx={{ fontFamily: (t) => t.typography.h6.fontFamily }}>
              Aniversariantes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Próximas datas da família
            </Typography>
          </Box>
        </Stack>

        {isLoading ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: 'center' }}>
            Carregando…
          </Typography>
        ) : isError ? (
          <Typography variant="body2" color="text.disabled" sx={{ py: 4, textAlign: 'center' }}>
            Não foi possível carregar os aniversários.
          </Typography>
        ) : items.length === 0 ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 4 }}>
            <CakeRoundedIcon sx={{ color: 'text.disabled' }} />
            <Typography variant="body2" color="text.disabled" textAlign="center">
              Nenhum membro com data de nascimento cadastrada.
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={0.5}>
            {items.map((b) => (
              <BirthdayRow key={b.id} b={b} />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  )
}

export default BirthdayBoard
