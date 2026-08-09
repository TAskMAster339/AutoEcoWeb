import { useState } from 'react'
import { Box, Menu, MenuItem, Paper, Typography, useTheme } from '@mui/material'
import { NavLink } from 'react-router-dom'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useAuthStore } from '../../store/authStore'
import { alpha } from '@mui/material/styles'
import { softBg, softFg } from '../../theme'

const MAIN_ITEMS = [
  { to: '/transactions', label: 'Таблица', icon: TableChartOutlinedIcon },
  { to: '/analytics', label: 'Аналитика', icon: BarChartOutlinedIcon },
  { to: '/dashboard', label: 'Чеки', icon: ReceiptLongOutlinedIcon },
  { to: '/tags', label: 'Теги', icon: LabelOutlinedIcon },
] as const

function NavButton({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: typeof TableChartOutlinedIcon
}) {
  const theme = useTheme()
  return (
    <Box
      component={NavLink}
      to={to}
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        py: 0.75,
        borderRadius: '8px',
        textDecoration: 'none',
        color: 'text.secondary',
        '&.active': { color: softFg(theme), bgcolor: softBg(theme) },
      }}
    >
      <Icon sx={{ fontSize: 22 }} />
      <Typography sx={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.2 }}>{label}</Typography>
    </Box>
  )
}

export function BottomNav() {
  const theme = useTheme()
  const role = useAuthStore((s) => s.user?.role)
  const [moreAnchor, setMoreAnchor] = useState<null | HTMLElement>(null)

  const moreItems = [
    { to: '/rules', label: 'Правила и алиасы', icon: LinkOutlinedIcon },
    { to: '/data', label: 'Данные', icon: StorageOutlinedIcon },
    { to: '/settings', label: 'Настройки', icon: SettingsOutlinedIcon },
    { to: '/about', label: 'О приложении', icon: InfoOutlinedIcon },
    ...(role === 'admin' ? [{ to: '/admin', label: 'Администрирование', icon: AdminPanelSettingsOutlinedIcon }] : []),
  ]

  return (
    <Paper
      elevation={0}
      className="safe-bottom"
      component="nav"
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1200,
        borderTop: `1px solid ${theme.palette.divider}`,
        borderBottom: 'none',
        borderRadius: 0,
        display: 'flex',
        alignItems: 'stretch',
        px: 1,
        py: 0.5,
        bgcolor: alpha(theme.palette.background.paper, 0.92),
        backdropFilter: 'blur(12px)',
        boxShadow: theme.palette.mode === 'dark' ? '0 -4px 20px rgba(0,0,0,0.4)' : '0 -4px 20px rgba(16,24,40,0.06)',
      }}
      aria-label="Мобильная навигация"
    >
      {MAIN_ITEMS.map((item) => (
        <NavButton key={item.to} {...item} />
      ))}
      <Box
        component="button"
        type="button"
        onClick={(e) => setMoreAnchor(e.currentTarget)}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 0.25,
          py: 0.75,
          borderRadius: '8px',
          border: 'none',
          bgcolor: 'transparent',
          cursor: 'pointer',
          color: 'text.secondary',
          fontFamily: 'inherit',
        }}
        aria-label="Ещё"
      >
        <MoreHorizIcon sx={{ fontSize: 22 }} />
        <Typography sx={{ fontSize: 10.5, fontWeight: 600, lineHeight: 1.2 }}>Ещё</Typography>
      </Box>
      <Menu anchorEl={moreAnchor} open={Boolean(moreAnchor)} onClose={() => setMoreAnchor(null)}>
        {moreItems.map(({ to, label, icon: Icon }) => (
          <MenuItem
            key={to}
            component={NavLink}
            to={to}
            onClick={() => setMoreAnchor(null)}
          >
            <Icon sx={{ mr: 1.5, fontSize: 20 }} /> {label}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  )
}
