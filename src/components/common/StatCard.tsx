import { isValidElement, type ReactNode } from 'react'
import { alpha, Box, Card, CardContent, LinearProgress, Skeleton, Stack, Typography, useTheme } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'

export type StatTone = 'primary' | 'success' | 'error' | 'warning' | 'info'

type Props = {
  label: string
  value: ReactNode
  /** Uma linha explicando o recorte (eixo, contagem). Evita a leitura errada do número. */
  hint?: string
  /** Ícone à direita (componente MUI) ou nó pronto. */
  icon?: SvgIconComponent | ReactNode
  /** Cor do valor e do ícone: chave da paleta (`warning.main`), tom (`warning`) ou hex. */
  color?: StatTone | string
  /** Mostra skeleton no lugar do valor. */
  loading?: boolean
  /** Barra de progresso 0–100 abaixo do valor (ex.: realizado vs previsto). */
  progress?: number
}

// Ícone MUI é `memo(forwardRef(...))`: objeto, não função. Elemento pronto
// (`<Foo />`) é o único caso que renderiza direto.
function isIconComponent(icon: Props['icon']): icon is SvgIconComponent {
  return icon != null && typeof icon !== 'string' && typeof icon !== 'number' && typeof icon !== 'boolean' && !isValidElement(icon) && !Array.isArray(icon)
}

/**
 * Card de indicador (label + valor + hint, ícone opcional). Único para todas
 * as páginas: no telefone fica compacto (fonte menor, menos padding) para a
 * grade de 2 colunas; no desktop mantém o tamanho de leitura.
 */
export function StatCard({ label, value, hint, icon, color, loading, progress }: Props) {
  const theme = useTheme()
  const tone = (['primary', 'success', 'error', 'warning', 'info'] as const).find((t) => t === color)
  const resolved = tone
    ? theme.palette[tone].main
    : color?.includes('.')
      ? (color.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown>)?.[k], theme.palette) as string) ?? color
      : (color ?? theme.palette.primary.main)
  const valueColor = color ? resolved : undefined

  let iconNode: ReactNode = null
  if (icon) {
    const Icon = isIconComponent(icon) ? icon : null
    iconNode = (
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          width: 44,
          height: 44,
          flexShrink: 0,
          borderRadius: 2,
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(resolved, theme.palette.mode === 'dark' ? 0.16 : 0.12),
          color: resolved,
        }}
      >
        {Icon ? <Icon /> : (icon as ReactNode)}
      </Box>
    )
  }

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: { xs: 1.5, sm: 2.5 }, '&:last-child': { pb: { xs: 1.5, sm: 2.5 } } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="overline"
              color="text.secondary"
              noWrap
              sx={{ display: 'block', lineHeight: 1.6, fontSize: { xs: 10, sm: 12 } }}
            >
              {label}
            </Typography>
            {loading ? (
              <Skeleton width={110} height={30} sx={{ mt: 0.25 }} />
            ) : (
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                color: valueColor,
                mt: 0.25,
                fontSize: { xs: '1.05rem', sm: '1.5rem' },
                lineHeight: 1.2,
                // Telefone: 2 colunas de ~150px. A fonte display (larga) não
                // cabe em "R$ 22.628,74"; usa a fonte de texto, sem quebrar.
                fontFamily: { xs: theme.typography.fontFamily, sm: theme.typography.h5.fontFamily },
                whiteSpace: 'nowrap',
              }}
            >
              {value}
            </Typography>
            )}
            {hint && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.5, fontSize: { xs: 10.5, sm: 12 } }}
              >
                {hint}
              </Typography>
            )}
          </Box>
          {iconNode}
        </Stack>
        {progress != null && (
          <LinearProgress
            variant="determinate"
            value={Math.max(0, Math.min(100, progress))}
            sx={{
              mt: { xs: 1.25, sm: 2 },
              height: 6,
              borderRadius: 3,
              bgcolor: alpha(resolved, 0.12),
              '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: resolved },
            }}
          />
        )}
      </CardContent>
    </Card>
  )
}
