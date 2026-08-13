import { Alert, Box, Button, useMediaQuery, useTheme } from '@mui/material'
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { FloatingAddButton } from './FloatingAddButton'
import { AddMenu } from '../common/AddMenu'
import { OfflineBanner } from './OfflineBanner'
import { Footer } from './Footer'
import { useOnline } from '../../hooks/useOnline'
import { useAuthStore } from '../../store/authStore'

/**
 * Responsive app shell:
 * - desktop (md+): sidebar + header + content + footer
 * - mobile: top bar + content + bottom navigation + floating add button
 */
export function AppShell() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const online = useOnline()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const isVerifiedOnly = user?.status === 'verified'
  const showMobileAdd = location.pathname === '/transactions' || location.pathname === '/receipt'

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100dvh',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      {!isMobile && <Sidebar />}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Header />
        {!online && <OfflineBanner />}
        {isVerifiedOnly && (
          <Alert
            severity="info"
            sx={{ mx: { xs: 1.5, md: 3 }, mt: 1.5, alignItems: 'center' }}
            action={
              <Button component={RouterLink} to="/feedback" color="inherit" size="small">
                Обратная связь
              </Button>
            }
          >
            Почта подтверждена. Дождитесь подтверждения аккаунта администратором — после этого откроется доступ к сервису.
          </Alert>
        )}

        {/* Planned scroll: the app is a fixed frame (sidebar/header/footer pinned);
            only <main> scrolls. scrollbar-gutter reserves the track so content
            overflow never shifts the layout. */}
        <Box
          component="main"
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            scrollbarGutter: 'stable',
            width: '100%',
            minWidth: 0,
            px: { xs: 1.5, sm: 2.5, md: 3 },
            py: { xs: 1.5, md: 3 },
            pb: isMobile ? 12 : 4,
          }}
        >
          <Outlet />
        </Box>

        <Footer />
      </Box>

      {isMobile && <BottomNav />}
      {isMobile && !isVerifiedOnly && showMobileAdd && <FloatingAddButton />}

      {/* Global «Добавить» menu — открывается из пустых состояний страниц */}
      {!isVerifiedOnly && <AddMenu />}
    </Box>
  )
}
