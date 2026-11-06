import { useMemo } from 'react'
import { alpha, BottomNavigation, BottomNavigationAction, Box, Paper } from '@mui/material'
import type { SvgIconComponent } from '@mui/icons-material'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded'
import MenuRoundedIcon from '@mui/icons-material/MenuRounded'
import { useLocation, useNavigate } from 'react-router-dom'
import { retechfinNavSections } from '@/layouts/nav-config-retechfin'
import { useFilteredNavData, type NavDataItem } from '@/layouts/components/nav-filter-by-casl'
import { useUiStore } from '@/store/uiStore'

export const MOBILE_BOTTOM_NAV_HEIGHT = 64

/** Query string que a página de Despesas lê para abrir o formulário direto. */
export const NEW_EXPENSE_SEARCH = '?nova=1'

type MobileNavItem = {
  key: string
  label: string
  icon: SvgIconComponent
  /** Rota do menu principal; o item só aparece se o usuário tem a permissão dela. */
  path: string
  /** Destino real (pode carregar query). Default: `path`. */
  to?: string
}

/**
 * Atalhos do rodapé no telefone. Lista só de UI (ordem e rótulo curto);
 * permissão vem do menu principal, pela rota — mesma fonte da sidebar.
 */
const MOBILE_NAV_ITEMS: MobileNavItem[] = [
  { key: 'hoje', label: 'Hoje', icon: TaskAltRoundedIcon, path: '/dashboard/financeiro/contas-do-dia' },
  { key: 'despesas', label: 'Despesas', icon: TrendingDownRoundedIcon, path: '/dashboard/financeiro/despesas' },
  {
    key: 'nova',
    label: 'Lançar',
    icon: AddRoundedIcon,
    path: '/dashboard/financeiro/despesas',
    to: `/dashboard/financeiro/despesas${NEW_EXPENSE_SEARCH}`,
  },
  { key: 'cupons', label: 'Cupons', icon: ReceiptLongRoundedIcon, path: '/dashboard/financeiro/cupons' },
]

function flattenPaths(items: NavDataItem[], out: Set<string>) {
  for (const it of items) {
    if (!it.soon) out.add(it.path)
    if (it.children) flattenPaths(it.children, out)
  }
}

export function MobileBottomNav() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const sections = useFilteredNavData(retechfinNavSections)

  const allowed = useMemo(() => {
    const set = new Set<string>()
    for (const s of sections) flattenPaths(s.items, set)
    return set
  }, [sections])

  const items = MOBILE_NAV_ITEMS.filter((it) => allowed.has(it.path))
  const current = items.find((it) => !it.to && pathname === it.path)?.key ?? false

  return (
    <Paper
      component="nav"
      aria-label="Navegação rápida"
      elevation={0}
      square
      sx={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: (t) => t.zIndex.appBar,
        display: { xs: 'block', sm: 'none' },
        borderTop: 1,
        borderColor: 'divider',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        bgcolor: (t) => alpha(t.palette.background.default, 0.85),
        backdropFilter: 'blur(20px)',
        // Barra home do iPhone: a safe-area empurra o conteúdo pra cima.
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      <BottomNavigation
        value={current}
        showLabels
        onChange={(_, key: string) => {
          if (key === 'menu') {
            toggleSidebar()
            return
          }
          const item = items.find((it) => it.key === key)
          if (item) navigate(item.to ?? item.path)
        }}
        sx={{ height: MOBILE_BOTTOM_NAV_HEIGHT, bgcolor: 'transparent' }}
      >
        {items.map((it) => {
          const Icon = it.icon
          const isPrimary = it.key === 'nova'
          return (
            <BottomNavigationAction
              key={it.key}
              value={it.key}
              label={it.label}
              icon={
                isPrimary ? (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: 'primary.contrastText',
                      background: (t) =>
                        `linear-gradient(90deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 100%)`,
                      boxShadow: (t) => `0 0 18px ${alpha(t.palette.primary.main, 0.45)}`,
                      mb: 0.25,
                    }}
                  >
                    <Icon />
                  </Box>
                ) : (
                  <Icon />
                )
              }
              sx={{ minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: 11 } }}
            />
          )
        })}
        <BottomNavigationAction value="menu" label="Menu" icon={<MenuRoundedIcon />} sx={{ minWidth: 0, px: 0.5, '& .MuiBottomNavigationAction-label': { fontSize: 11 } }} />
      </BottomNavigation>
    </Paper>
  )
}
