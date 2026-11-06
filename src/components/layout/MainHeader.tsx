import {
  AppBar,
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import { Link as RouterLink } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'
import { UserMenu } from './UserMenu'
import { AppLogo } from './AppLogo'
import { useUiStore } from '@/store/uiStore'

const DRAWER_WIDTH = 300
const DRAWER_MINI_WIDTH = 76

type Props = {
  title?: string
}

export function MainHeader({ title = 'Painel' }: Props) {
  const theme = useTheme()
  const isLg = useMediaQuery(theme.breakpoints.up('lg'))
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const toggleSidebarCollapsed = useUiStore((s) => s.toggleSidebarCollapsed)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)

  // Desktop: expandida = largura cheia; recolhida = mini-rail (só ícones).
  const lgWidth = sidebarCollapsed ? DRAWER_MINI_WIDTH : DRAWER_WIDTH

  return (
    <AppBar
      position="fixed"
      color="default"
      elevation={0}
      sx={{
        width: { lg: `calc(100% - ${lgWidth}px)` },
        ml: { lg: `${lgWidth}px` },
        pt: 'env(safe-area-inset-top)',
        transition: (t) =>
          t.transitions.create(['width', 'margin'], { duration: t.transitions.duration.shorter }),
      }}
    >
      <Toolbar sx={{ gap: 2, minHeight: { xs: 64, sm: 72 } }}>
        <IconButton
          color="inherit"
          edge="start"
          onClick={isLg ? toggleSidebarCollapsed : toggleSidebar}
          aria-label={isLg ? (sidebarCollapsed ? 'Expandir menu' : 'Recolher menu') : 'Abrir menu'}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}
        >
          <MenuRoundedIcon />
        </IconButton>

        {/* Logo compacta só no mobile (no desktop a rail já mostra a logo): leva à home */}
        {!isLg && (
          <Box
            component={RouterLink}
            to="/dashboard"
            aria-label="Ir para o painel"
            sx={{ display: 'flex', alignItems: 'center', borderRadius: 2, p: 0.5, m: -0.5 }}
          >
            <AppLogo compact />
          </Box>
        )}

        <Typography
          variant="h6"
          component="h1"
          sx={{
            display: { xs: 'none', lg: 'block' },
            fontFamily: (t) => t.typography.h5.fontFamily,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {title}
        </Typography>

        <TextField
          size="small"
          placeholder="Buscar..."
          aria-label="Buscar"
          sx={{
            flex: 1,
            maxWidth: { xs: '100%', sm: 360, lg: 420 },
            ml: { xs: 0, lg: 2 },
            display: { xs: 'none', sm: 'inline-flex' },
          }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Empurra ThemeToggle + UserMenu para a direita */}
        <Box sx={{ flexGrow: 1 }} />

        <ThemeToggle />
        <UserMenu />
      </Toolbar>
    </AppBar>
  )
}

export const LAYOUT_DRAWER_WIDTH = DRAWER_WIDTH
export const LAYOUT_DRAWER_MINI_WIDTH = DRAWER_MINI_WIDTH
