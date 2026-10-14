import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Box, Drawer, Toolbar, useMediaQuery, useTheme } from '@mui/material'
import {
  MainHeader,
  LAYOUT_DRAWER_WIDTH,
  LAYOUT_DRAWER_MINI_WIDTH,
} from '@/components/layout/MainHeader'
import { SidebarNav } from '@/components/layout/SidebarNav'
import { useCatalogs } from '@/lib/catalogs/useCatalog'
import { useUiStore } from '@/store/uiStore'

export function DashboardLayout() {
  const theme = useTheme()
  const isLg = useMediaQuery(theme.breakpoints.up('lg'))
  const { sidebarOpen, setSidebarOpen, sidebarCollapsed } = useUiStore()
  // Catálogos de enum (rótulos da API): uma chamada por sessão, logo após o
  // login, para as páginas já encontrarem os rótulos em cache.
  useCatalogs()

  useEffect(() => {
    if (isLg) setSidebarOpen(false)
  }, [isLg, setSidebarOpen])

  // Desktop: recolhida vira mini-rail (só ícones), não some.
  const desktopWidth = sidebarCollapsed ? LAYOUT_DRAWER_MINI_WIDTH : LAYOUT_DRAWER_WIDTH

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <MainHeader />

      <Drawer
        variant="temporary"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', lg: 'none' },
          [`& .MuiDrawer-paper`]: {
            width: LAYOUT_DRAWER_WIDTH,
            boxSizing: 'border-box',
          },
        }}
      >
        <SidebarNav onNavigate={() => setSidebarOpen(false)} />
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', lg: 'block' },
          width: desktopWidth,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: {
            width: desktopWidth,
            boxSizing: 'border-box',
            overflowX: 'hidden',
            transition: theme.transitions.create('width', {
              duration: theme.transitions.duration.shorter,
            }),
          },
        }}
        open
      >
        <SidebarNav collapsed={sidebarCollapsed} />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { lg: `calc(100% - ${desktopWidth}px)` },
          minHeight: '100vh',
          px: { xs: 2, sm: 3 },
          py: 3,
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 64, sm: 72 } }} />
        <Outlet />
      </Box>
    </Box>
  )
}
