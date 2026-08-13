import {
  Box,
  IconButton,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import BrightnessAutoOutlinedIcon from '@mui/icons-material/BrightnessAutoOutlined'
import { useLocation, useNavigate } from 'react-router-dom'
import { alpha } from '@mui/material/styles'
import { useUiStore } from '../../store/uiStore'
import type { ThemeMode } from '../../store/uiStore'
import { Logo } from '../common/Logo'
import { PeriodSelector } from '../common/PeriodSelector'

const TITLES: Record<string, string> = {
  '/transactions': 'Таблица',
  '/analytics': 'Аналитика',
  '/receipt': 'Чеки',
  '/tags': 'Теги',
  '/rules': 'Правила',
  '/sellers': 'Магазины',
  '/data': 'Данные',
  '/profile': 'Профиль',
  '/admin': 'Администрирование',
  '/about': 'Справка',
  '/privacy': 'Конфиденциальность',
  '/feedback': 'Обратная связь',
}

/** Подпись кнопки темы в шапке — текущий режим (а не следующий по кругу). */
const THEME_LABEL: Record<ThemeMode, string> = {
  light: 'Светлая тема',
  dark: 'Тёмная тема',
  system: 'Системная тема',
}

export function Header() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const location = useLocation()
  const navigate = useNavigate()
  const themeMode = useUiStore((s) => s.themeMode)
  const toggleThemeMode = useUiStore((s) => s.toggleThemeMode)
  const title = location.pathname.startsWith('/about/') ? 'Справка' : TITLES[location.pathname] ?? 'AutoEco'

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 1100,
        bgcolor: alpha(theme.palette.background.paper, 0.85),
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${theme.palette.divider}`,
        px: { xs: 1.5, md: 3 },
        py: { xs: 1, md: 1.25 },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, md: 2 }, minWidth: 0 }}>
        {isMobile && <Logo compact onClick={() => navigate('/transactions')} />}
        <Typography variant="h5" sx={{ fontSize: { xs: 17, md: 22 }, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </Typography>

        <Box sx={{ flex: 1 }} />

        <PeriodSelector />

        <Tooltip title={THEME_LABEL[themeMode]}>
          <IconButton
            onClick={toggleThemeMode}
            aria-label="Переключить тему"
            size={isMobile ? 'small' : 'medium'}
            sx={{ color: 'text.secondary', flexShrink: 0 }}
          >
            {themeMode === 'dark' ? (
              <DarkModeOutlinedIcon />
            ) : themeMode === 'system' ? (
              <BrightnessAutoOutlinedIcon />
            ) : (
              <LightModeOutlinedIcon />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
}
