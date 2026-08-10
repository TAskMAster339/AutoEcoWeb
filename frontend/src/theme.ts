import { alpha, createTheme, type Theme } from '@mui/material/styles'

/**
 * AutoEco design tokens — Apple/Linear-like:
 * white/dark background, soft shadows, slightly rounded corners (mockup:
 * NOT overly rounded), purple accent, no gradients (except the logo).
 */
export const colors = {
  primary: '#6C5CE7',
  primaryDark: '#5A4BD1',
  primarySoft: '#EEEAFC',
  green: '#16A34A',
  greenSoft: '#E7F6EC',
  red: '#DC2626',
  redSoft: '#FDEBEB',
  amber: '#F59E0B',
  amberSoft: '#FEF3E2',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  border: '#E7E7EF',
  bg: '#F7F7FA',
  card: '#FFFFFF',
} as const

const dark = {
  bg: '#0F0F13',
  paper: '#17171C',
  card: '#1A1A20',
  border: '#26262E',
  textPrimary: '#F2F2F6',
  textSecondary: '#9C9CA8',
  hover: '#20202A',
} as const

/** Soft purple background (active nav item, chips…) — adapts to mode. */
export function softBg(theme: Theme): string {
  return alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.1)
}

/** Foreground for elements on a soft purple background. */
export function softFg(theme: Theme): string {
  return theme.palette.mode === 'dark' ? '#B7AFFF' : colors.primaryDark
}

/** Card border that works in both modes. */
export function borderColor(theme: Theme): string {
  return theme.palette.divider
}

export function buildTheme(mode: 'light' | 'dark'): Theme {
  const isDark = mode === 'dark'

  const palette = isDark
    ? {
        mode: 'dark' as const,
        primary: {
          main: colors.primary,
          dark: '#5A4BD1',
          light: '#B7AFFF',
          contrastText: '#FFFFFF',
        },
        success: { main: colors.green, contrastText: '#FFFFFF' },
        error: { main: colors.red, contrastText: '#FFFFFF' },
        warning: { main: colors.amber },
        background: { default: dark.bg, paper: dark.paper },
        text: { primary: dark.textPrimary, secondary: dark.textSecondary },
        divider: dark.border,
      }
    : {
        mode: 'light' as const,
        primary: {
          main: colors.primary,
          dark: colors.primaryDark,
          light: '#8B7FF0',
          contrastText: '#FFFFFF',
        },
        success: { main: colors.green, contrastText: '#FFFFFF' },
        error: { main: colors.red, contrastText: '#FFFFFF' },
        warning: { main: colors.amber },
        background: { default: colors.bg, paper: colors.card },
        text: { primary: colors.textPrimary, secondary: colors.textSecondary },
        divider: colors.border,
      }

  return createTheme({
    palette,
    // MUI v6 multiplies NUMERIC borderRadius values in sx/styleOverrides by
    // theme.shape.borderRadius (default 4): borderRadius: 10 would render as
    // 40px (and as 80px with the old 8 here). Every radius in this codebase is
    // written as a px-intent number (dialog 10, chip 6, button/icon 8…), so the
    // multiplier must be 1. String radii ('8px') are never multiplied.
    shape: { borderRadius: 1 },
    typography: {
      fontFamily:
        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      h4: { fontWeight: 700, letterSpacing: '-0.02em' },
      h5: { fontWeight: 700, letterSpacing: '-0.015em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, paddingInline: 16, paddingBlock: 8 },
          containedPrimary: {
            boxShadow: isDark
              ? '0 1px 2px rgba(0,0,0,0.4)'
              : '0 1px 2px rgba(108,92,231,0.3)',
            '&:hover': {
              boxShadow: isDark
                ? '0 4px 12px rgba(0,0,0,0.5)'
                : '0 4px 12px rgba(108,92,231,0.35)',
            },
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: `1px solid ${palette.divider}`,
            boxShadow: isDark
              ? '0 1px 2px rgba(0,0,0,0.35)'
              : '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
          },
        },
      },
      MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 6, fontWeight: 600, height: 26 },
          colorPrimary: ({ theme }) => ({
            backgroundColor: softBg(theme),
            color: softFg(theme),
            // Выбранный чип (filled+primary) при ховере/фокусе получает от MUI
            // сплошной фиолетовый фон (clickableColorPrimary:hover), а цвет
            // текста оставался softFg — в светлой теме текст сливался с фоном.
            // Ховер/фокус: сплошной фиолетовый фон + белый текст.
            '&:hover, &.Mui-focusVisible': {
              backgroundColor: theme.palette.primary.dark,
              color: theme.palette.primary.contrastText,
            },
          }),
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 10 } },
      },
      /* «Квадратный» дизайн: никаких кругов — иконки-кнопки, аватары и FAB
         прямоугольные с малым скруглением. */
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiAvatar: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
      MuiFab: {
        styleOverrides: { root: { borderRadius: '14px' } },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiTooltip: {
        styleOverrides: { tooltip: { borderRadius: 6, fontSize: 12 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: isDark ? '#101016' : '#FFFFFF',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
    },
  })
}

/** Light theme — backward compatibility export. */
export const theme = buildTheme('light')
