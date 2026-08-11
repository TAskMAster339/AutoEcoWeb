import { NavLink } from 'react-router-dom'
import {
  Avatar,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MenuIcon from '@mui/icons-material/Menu'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'
import { Logo } from '../common/Logo'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { softBg, softFg } from '../../theme'

const NAV_ITEMS = [
  { to: '/transactions', label: 'Таблица', icon: TableChartOutlinedIcon },
  { to: '/analytics', label: 'Аналитика', icon: BarChartOutlinedIcon },
  { to: '/dashboard', label: 'Чеки', icon: ReceiptLongOutlinedIcon },
  { to: '/tags', label: 'Теги', icon: LabelOutlinedIcon },
  { to: '/sellers', label: 'Магазины', icon: StorefrontOutlinedIcon },
  { to: '/rules', label: 'Правила', icon: LinkOutlinedIcon },
  { to: '/data', label: 'Данные', icon: StorageOutlinedIcon },
  { to: '/about', label: 'О приложении', icon: InfoOutlinedIcon },
] as const

const ROLE_LABELS: Record<string, string> = { user: 'Базовый план', admin: 'Администратор' }

/**
 * Высота секции лого в сайдбаре = высоте хедера (Header: py 1.25 + контент 40px ≈ 62px),
 * чтобы верхняя линия сайдбара визуально совпадала с хедером.
 */
const HEADER_HEIGHT = 62
/** Высота пункта меню — фиксированная в обоих состояниях, чтобы иконки
 *  не «подпрыгивали» при сворачивании (без текста кнопка не ужимается). */
const NAV_ITEM_HEIGHT = 44
/** Высота карточки пользователя — фиксированная по той же причине. */
const USER_CARD_HEIGHT = 54

export function Sidebar() {
  const theme = useTheme()
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const role = useAuthStore((s) => s.user?.role)
  const user = useAuthStore((s) => s.user)
  const isDark = theme.palette.mode === 'dark'
  const sidebarBg = theme.palette.background.paper
  const hoverBg = isDark ? 'rgba(255,255,255,0.05)' : '#F1F0FB'

  return (
    <Box
      component="aside"
      sx={{
        width: collapsed ? 64 : 232,
        flexShrink: 0,
        height: '100dvh',
        position: 'sticky',
        top: 0,
        bgcolor: sidebarBg,
        borderRight: `1px solid ${theme.palette.divider}`,
        display: 'flex',
        flexDirection: 'column',
        px: collapsed ? 0 : 1.5,
        pt: 0,
        pb: 2,
        transition: 'width 0.2s ease',
        overflow: 'hidden',
      }}
    >
      {/* Header row: logo + collapse toggle, one row in both states with the
          same height (minHeight = header height 62px). The fixed height keeps
          the nav list below at the same Y position, so icons never jump. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'flex-start' : 'space-between',
          gap: 0,
          pl: collapsed ? 0.5 : 0,
          minHeight: HEADER_HEIGHT,
        }}
      >
        <Logo compact={collapsed} />
        <Tooltip title={collapsed ? 'Развернуть меню' : 'Свернуть меню'} placement="right" arrow>
          <IconButton
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
            size="small"
            sx={{ width: collapsed ? 26 : 30, height: collapsed ? 26 : 30, color: 'text.secondary' }}
          >
            {collapsed ? <MenuIcon fontSize="small" /> : <MenuOpenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <Divider sx={{ mx: collapsed ? 0.5 : 1, mb: 1.5 }} />

      <List component="nav" sx={{ flex: 1, px: 0 }} aria-label="Основная навигация">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Tooltip key={to} title={collapsed ? label : ''} placement="right" arrow>
            <ListItemButton
              component={NavLink}
              to={to}
              sx={{
                mb: 0.5,
                height: NAV_ITEM_HEIGHT,
                px: collapsed ? 0 : 1,
                color: 'text.secondary',
                '&.active': {
                  bgcolor: softBg(theme),
                  color: softFg(theme),
                  fontWeight: 700,
                },
                '&:hover': { bgcolor: hoverBg },
              }}
            >
              <ListItemIcon
                sx={{ minWidth: collapsed ? '100%' : 36, justifyContent: 'center', color: 'inherit' }}
              >
                <Icon sx={{ fontSize: 21 }} />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText primary={label} primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }} />
              )}
            </ListItemButton>
          </Tooltip>
        ))}
        {role === 'admin' && (
          <Tooltip title={collapsed ? 'Администрирование' : ''} placement="right" arrow>
            <ListItemButton
              component={NavLink}
              to="/admin"
              sx={{
                mb: 0.5,
                height: NAV_ITEM_HEIGHT,
                px: collapsed ? 0 : 1,
                color: 'text.secondary',
                '&.active': { bgcolor: softBg(theme), color: softFg(theme), fontWeight: 700 },
                '&:hover': { bgcolor: hoverBg },
              }}
            >
              <ListItemIcon
                sx={{ minWidth: collapsed ? '100%' : 36, justifyContent: 'center', color: 'inherit' }}
              >
                <AdminPanelSettingsOutlinedIcon sx={{ fontSize: 21 }} />
              </ListItemIcon>
              {!collapsed && (
                <ListItemText
                  primary="Администрирование"
                  primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
                />
              )}
            </ListItemButton>
          </Tooltip>
        )}
      </List>

      {/* User — fixed-height card: avatar tile (collapsed) or avatar + email/plan.
          Клик по карточке ведёт в профиль (/profile). */}
      <Divider sx={{ mx: collapsed ? 0.5 : 1, my: 1.5 }} />
      <Tooltip title={collapsed ? 'Профиль' : ''} placement="right" arrow>
        <Box
          component={NavLink}
          to="/profile"
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 1.25,
            px: collapsed ? 0 : 1.25,
            height: USER_CARD_HEIGHT,
            borderRadius: '8px',
            bgcolor: collapsed ? 'transparent' : isDark ? 'rgba(255,255,255,0.04)' : '#F7F7FA',
            minWidth: 0,
            textDecoration: 'none',
            color: 'inherit',
            '&.active': { bgcolor: softBg(theme), color: softFg(theme) },
            '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : '#EFEFF5' },
          }}
          aria-label="Профиль"
        >
          <Avatar
            sx={{
              width: 34,
              height: 34,
              bgcolor: softBg(theme),
              color: softFg(theme),
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {user?.email.charAt(0).toUpperCase() ?? '?'}
          </Avatar>
          {!collapsed && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email ?? 'Гость'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11.5 }}>
                {ROLE_LABELS[role ?? 'user'] ?? role}
              </Typography>
            </Box>
          )}
        </Box>
      </Tooltip>
    </Box>
  )
}
