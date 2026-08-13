import { useMemo, useState } from 'react'
import { Box, IconButton, Paper, Typography, useTheme } from '@mui/material'
import { NavLink, useLocation } from 'react-router-dom'
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined'
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import LabelOutlinedIcon from '@mui/icons-material/LabelOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import LinkOutlinedIcon from '@mui/icons-material/LinkOutlined'
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined'
import AddIcon from '@mui/icons-material/Add'
import { alpha } from '@mui/material/styles'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { softBg, softFg } from '../../theme'
import { BottomSheet } from '../common/BottomSheet'

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
        height: 54,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.25,
        borderRadius: '8px',
        textDecoration: 'none',
        color: 'text.secondary',
        WebkitTapHighlightColor: 'transparent',
        '&.active': { color: softFg(theme), bgcolor: softBg(theme) },
      }}
    >
      <Icon sx={{ fontSize: 21 }} />
      <Typography sx={{ fontSize: 10, fontWeight: 650, lineHeight: 1.15 }}>{label}</Typography>
    </Box>
  )
}

export function BottomNav() {
  const theme = useTheme()
  const location = useLocation()
  const role = useAuthStore((s) => s.user?.role)
  const isVerifiedOnly = useAuthStore((s) => s.user?.status === 'verified')
  const openAddMenu = useUiStore((s) => s.openAddMenu)
  const [moreOpen, setMoreOpen] = useState(false)

  const moreItems = useMemo(
    () => [
      { to: '/tags', label: 'Теги', icon: LabelOutlinedIcon },
      { to: '/sellers', label: 'Магазины', icon: StorefrontOutlinedIcon },
      { to: '/rules', label: 'Правила', icon: LinkOutlinedIcon },
      { to: '/data', label: 'Данные', icon: StorageOutlinedIcon },
      { to: '/profile', label: 'Профиль', icon: PersonOutlineIcon },
      { to: '/feedback', label: 'Обратная связь', icon: SupportAgentOutlinedIcon },
      { to: '/about', label: 'О приложении', icon: InfoOutlinedIcon },
      ...(role === 'admin'
        ? [{ to: '/admin', label: 'Администрирование', icon: AdminPanelSettingsOutlinedIcon }]
        : []),
    ],
    [role],
  )
  const moreActive = moreItems.some((item) => item.to === location.pathname)

  if (isVerifiedOnly) return null

  return (
    <>
      <Paper
        elevation={0}
        component="nav"
        sx={{
          position: 'fixed',
          bottom: 'calc(12px + env(safe-area-inset-bottom))',
          left: 12,
          right: 12,
          zIndex: 1200,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          px: 0.5,
          py: 0.5,
          bgcolor: alpha(theme.palette.background.paper, 0.94),
          backdropFilter: 'blur(18px)',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 12px 36px rgba(0,0,0,0.55)'
              : '0 12px 36px rgba(16,24,40,0.16)',
        }}
        aria-label="Мобильная навигация"
      >
        <NavButton to="/receipt" label="Чеки" icon={ReceiptLongOutlinedIcon} />
        <NavButton to="/analytics" label="Аналитика" icon={BarChartOutlinedIcon} />

        <Box sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <IconButton
            color="primary"
            onClick={openAddMenu}
            aria-label="Добавить чек или транзакцию"
            sx={{
              width: 48,
              height: 48,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              borderRadius: '10px',
              boxShadow: '0 8px 20px rgba(108,92,231,0.35)',
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            <AddIcon sx={{ fontSize: 28 }} />
          </IconButton>
        </Box>

        <NavButton to="/transactions" label="Таблица" icon={TableChartOutlinedIcon} />
        <Box
          component="button"
          type="button"
          onClick={() => setMoreOpen(true)}
          sx={{
            flex: 1,
            height: 54,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.25,
            borderRadius: '8px',
            border: 'none',
            bgcolor: moreActive ? softBg(theme) : 'transparent',
            cursor: 'pointer',
            color: moreActive ? softFg(theme) : 'text.secondary',
            fontFamily: 'inherit',
            WebkitTapHighlightColor: 'transparent',
          }}
          aria-label="Открыть дополнительную навигацию"
          aria-expanded={moreOpen}
        >
          <MoreHorizIcon sx={{ fontSize: 21 }} />
          <Typography sx={{ fontSize: 10, fontWeight: 650, lineHeight: 1.15 }}>Ещё</Typography>
        </Box>
      </Paper>

      <BottomSheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Ещё">
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
          {moreItems.map(({ to, label, icon: Icon }) => (
            <Paper
              key={to}
              component={NavLink}
              to={to}
              onClick={() => setMoreOpen(false)}
              variant="outlined"
              sx={{
                minHeight: 84,
                p: 1.5,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                textDecoration: 'none',
                color: 'text.primary',
                borderRadius: '8px',
                '&.active': {
                  borderColor: 'primary.main',
                  bgcolor: softBg(theme),
                  color: softFg(theme),
                },
              }}
            >
              <Icon sx={{ fontSize: 22 }} />
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{label}</Typography>
            </Paper>
          ))}
        </Box>
      </BottomSheet>
    </>
  )
}
