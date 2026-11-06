import { createTheme, alpha } from '@mui/material/styles'
import type { PaletteMode } from '@mui/material'
import { colorTemplate } from './colorTemplate'
import { fonts, glow } from './tokens'

const C = colorTemplate

/** Telefone: abaixo do breakpoint `sm` (600px) do MUI. Mesmo corte de useIsMobile(). */
const PHONE = '@media (max-width:599.95px)'

declare module '@mui/material/styles' {
  interface Palette {
    neon: {
      main: string
      bright: string
      dim: string
    }
  }
  interface PaletteOptions {
    neon?: {
      main: string
      bright: string
      dim: string
    }
  }
}

function paletteForMode(mode: PaletteMode) {
  const isDark = mode === 'dark'
  return {
    mode,
    primary: {
      main: C.primary.main,
      light: C.primary.light,
      dark: C.primary.dark,
      contrastText: C.primary.contrastText,
    },
    secondary: {
      main: C.primary.dark,
      light: C.primary.light,
      dark: C.secondary.dark,
      contrastText: C.primary.contrastText,
    },
    neon: {
      main: C.primary.main,
      bright: C.primary.light,
      dim: C.primary.dark,
    },
    background: {
      default: isDark ? C.surface.app : C.light.background,
      paper: isDark ? C.surface.elevated : C.light.paper,
    },
    text: {
      primary: isDark ? C.neutral.zinc100 : C.light.textPrimary,
      secondary: isDark ? C.neutral.zinc400 : C.neutral.zinc600,
      disabled: isDark ? alpha(C.neutral.zinc500, 0.5) : alpha(C.neutral.zinc600, 0.5),
    },
    divider: isDark ? C.border.subtle : C.border.onLight,
    action: {
      active: isDark ? C.neutral.zinc300 : C.neutral.zinc600,
      hover: isDark ? alpha(C.common.white, 0.05) : alpha(C.common.black, 0.04),
      selected: isDark ? alpha(C.primary.main, 0.12) : alpha(C.primary.main, 0.16),
      disabled: isDark ? alpha(C.common.white, 0.2) : alpha(C.common.black, 0.26),
      disabledBackground: isDark ? alpha(C.common.white, 0.08) : alpha(C.common.black, 0.08),
    },
  }
}

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'

  return createTheme({
    palette: paletteForMode(mode),
    typography: {
      fontFamily: fonts.body,
      fontWeightRegular: 400,
      fontWeightMedium: 500,
      fontWeightBold: 700,
      h1: { fontFamily: fonts.display, fontWeight: 800 },
      h2: { fontFamily: fonts.display, fontWeight: 800 },
      h3: { fontFamily: fonts.display, fontWeight: 700 },
      h4: { fontFamily: fonts.display, fontWeight: 700 },
      h5: { fontFamily: fonts.display, fontWeight: 700 },
      h6: { fontFamily: fonts.display, fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      subtitle2: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? C.surface.app : C.light.background,
            backgroundImage: isDark
              ? `radial-gradient(ellipse 80% 50% at 50% -20%, ${alpha(C.primary.main, 0.12)}, transparent),
                 radial-gradient(circle at 80% 60%, ${alpha(C.primary.dark, 0.06)}, transparent 50%)`
              : 'none',
            backgroundAttachment: 'fixed',
          },
          '::selection': {
            backgroundColor: alpha(C.primary.main, C.selection.backgroundAlpha),
            color: C.selection.foreground,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 12, fontWeight: 700 },
          containedPrimary: {
            color: C.primary.contrastText,
            background: `linear-gradient(90deg, ${C.primary.dark} 0%, ${C.primary.main} 100%)`,
            boxShadow: glow.btn,
            '&:hover': {
              background: `linear-gradient(90deg, ${C.primary.dark} 0%, ${C.primary.main} 100%)`,
              filter: 'brightness(1.08)',
              boxShadow: glow.btn,
            },
            // O gradiente acima também vale desabilitado (loading) — sem isto o
            // MUI aplica texto cinza sobre o verde e o rótulo some.
            '&.Mui-disabled': {
              color: alpha(C.primary.contrastText, 0.75),
              background: `linear-gradient(90deg, ${alpha(C.primary.dark, 0.55)} 0%, ${alpha(C.primary.main, 0.55)} 100%)`,
              boxShadow: 'none',
            },
          },
          outlined: {
            borderColor: isDark ? C.border.strong : C.border.onLight12,
            '&:hover': {
              borderColor: alpha(C.primary.main, 0.4),
              backgroundColor: isDark ? alpha(C.common.white, 0.04) : alpha(C.primary.main, 0.06),
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            ...(isDark && {
              border: `1px solid ${C.border.subtle}`,
            }),
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: isDark ? alpha(C.surface.app, 0.72) : alpha(C.light.paper, 0.72),
            backdropFilter: 'blur(20px)',
            boxShadow: 'none',
            /* Anula o border geral do MuiPaper para o AppBar não ter traço em nenhum lado */
            border: 'none',
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: isDark ? C.surface.app : C.surface.drawerLight,
            borderRight: `1px solid ${isDark ? C.chrome.drawerBorderDark : C.chrome.drawerBorderLight}`,
            backgroundImage: 'none',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            marginBottom: 4,
            '&.Mui-selected': {
              backgroundColor: alpha(C.primary.main, isDark ? 0.12 : 0.14),
              border: `1px solid ${alpha(C.primary.main, 0.35)}`,
              boxShadow: isDark ? glow.ring : 'none',
              '&:hover': {
                backgroundColor: alpha(C.primary.main, isDark ? 0.16 : 0.18),
              },
            },
          },
        },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'medium' },
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              backgroundColor: isDark ? alpha(C.common.black, 0.35) : alpha(C.common.black, 0.02),
            },
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          notchedOutline: {
            borderColor: isDark ? C.border.strong : C.border.onLight12,
          },
        },
      },
      // Telefone: todo Dialog vira tela cheia (sem margem, sem raio), com o
      // rodapé de ações fixo e acima da safe-area. Regra única no tema para
      // os diálogos existentes não precisarem de `fullScreen` um a um.
      MuiDialog: {
        styleOverrides: {
          root: {
            [PHONE]: {
              '& .MuiDialog-container': { alignItems: 'stretch' },
              '& .MuiDialog-paper': {
                margin: 0,
                width: '100%',
                maxWidth: '100%',
                height: '100%',
                maxHeight: '100%',
                borderRadius: 0,
                border: 'none',
              },
            },
          },
        },
      },
      MuiDialogActions: {
        styleOverrides: {
          root: {
            [PHONE]: {
              position: 'sticky',
              bottom: 0,
              backgroundColor: isDark ? C.surface.elevated : C.light.paper,
              borderTop: `1px solid ${isDark ? C.border.subtle : C.border.onLight}`,
              padding: '12px 16px',
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
              flexWrap: 'wrap',
              gap: 8,
              '& > :not(:first-of-type)': { marginLeft: 0 },
              '& .MuiButton-root': { flex: '1 1 auto', minHeight: 44 },
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            [PHONE]: {
              paddingLeft: 10,
              paddingRight: 10,
            },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: isDark ? C.surface.elevated : C.neutral.zinc900,
            border: `1px solid ${C.border.subtle}`,
            fontSize: 12,
          },
        },
      },
    },
  })
}
