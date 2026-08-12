import { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import AddIcon from '@mui/icons-material/Add'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined'
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import BrightnessAutoOutlinedIcon from '@mui/icons-material/BrightnessAutoOutlined'
import { useLocation } from 'react-router-dom'
import { useUiStore } from '../../store/uiStore'
import type { ThemeMode } from '../../store/uiStore'
import { Logo } from '../common/Logo'
import { alpha } from '@mui/material/styles'
import { useAuthStore } from '../../store/authStore'

const TITLES: Record<string, string> = {
  '/transactions': 'Таблица',
  '/analytics': 'Аналитика',
  '/dashboard': 'Чеки',
  '/tags': 'Теги',
  '/rules': 'Правила',
  '/profile': 'Профиль',
  '/admin': 'Администрирование',
  '/about': 'О приложении',
  '/feedback': 'Обратная связь',
}

/** Пауза ввода, после которой поиск применяется (иначе каждый символ
 *  дёргает сводку + список + грид — три запроса на нажатие клавиши). */
const SEARCH_DEBOUNCE_MS = 350

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
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)
  const closeAddMenu = useUiStore((s) => s.closeAddMenu)
  const openReceiptSheet = useUiStore((s) => s.openReceiptSheet)
  const openTransactionSheet = useUiStore((s) => s.openTransactionSheet)
  const themeMode = useUiStore((s) => s.themeMode)
  const isVerifiedOnly = useAuthStore((s) => s.user?.status === 'verified')
  const toggleThemeMode = useUiStore((s) => s.toggleThemeMode)

  const [addAnchor, setAddAnchor] = useState<null | HTMLElement>(null)
  // Локальное значение поля поиска: печатаем мгновенно, в стор пишем
  // по дебаунсу. Внешние изменения (сброс фильтров) синхронизируются ниже.
  const [searchInput, setSearchInput] = useState(search)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setSearchInput(search)
  }, [search])

  useEffect(() => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
  }, [])

  const onSearchChange = (value: string) => {
    setSearchInput(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setSearch(value), SEARCH_DEBOUNCE_MS)
  }

  const title = TITLES[location.pathname] ?? 'AutoEco'
  const showAdd = !isVerifiedOnly && (location.pathname === '/transactions' || location.pathname === '/dashboard')

  const searchField = (
    <TextField
      value={searchInput}
      onChange={(e) => onSearchChange(e.target.value)}
      placeholder="Поиск по чекам…"
      size="small"
      sx={{
        width: isMobile ? '100%' : 300,
        '& .MuiOutlinedInput-root': { borderRadius: '8px' },
      }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
            </InputAdornment>
          ),
        },
      }}
      aria-label="Поиск по чекам"
    />
  )

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
        px: { xs: 2, md: 3 },
        py: 1.25,
      }}
    >
      {/* Row 1: logo (mobile) / title + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {isMobile && <Logo compact />}
        <Typography variant="h5" sx={{ fontSize: { xs: 18, md: 22 }, whiteSpace: 'nowrap' }}>
          {title}
        </Typography>

        <Box sx={{ flex: 1 }} />

        {!isMobile && searchField}

        <Tooltip title={THEME_LABEL[themeMode]}>
          <IconButton
            onClick={toggleThemeMode}
            aria-label="Переключить тему"
            sx={{ color: 'text.secondary' }}
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

        {showAdd && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            endIcon={!isMobile ? <KeyboardArrowDownIcon /> : undefined}
            onClick={(e) => setAddAnchor(e.currentTarget)}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
          >
            Добавить
          </Button>
        )}
      </Box>

      {/* Row 2 (mobile only): search takes the full width — no cramping */}
      {isMobile && <Box sx={{ mt: 1.25 }}>{searchField}</Box>}

      {/* Добавить dropdown: чек (QR/камера) или транзакция (форма) */}
      <Menu anchorEl={addAnchor} open={Boolean(addAnchor)} onClose={() => setAddAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAddAnchor(null)
            closeAddMenu()
            openReceiptSheet()
          }}
        >
          <QrCodeScannerOutlinedIcon sx={{ mr: 1.5, fontSize: 20 }} /> Добавить чек
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddAnchor(null)
            closeAddMenu()
            openTransactionSheet()
          }}
        >
          <PlaylistAddOutlinedIcon sx={{ mr: 1.5, fontSize: 20 }} /> Добавить транзакцию
        </MenuItem>
      </Menu>
    </Box>
  )
}
