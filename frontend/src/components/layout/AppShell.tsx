import { Box, useMediaQuery, useTheme } from '@mui/material'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { FloatingAddButton } from './FloatingAddButton'
import { OfflineBanner } from './OfflineBanner'
import { Footer } from './Footer'
import { useOnline } from '../../hooks/useOnline'

/**
 * Responsive app shell:
 * - desktop (md+): sidebar + header + content + footer
 * - mobile: top bar + content + bottom navigation + floating add button
 */
export function AppShell() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const online = useOnline()

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
      {isMobile && <FloatingAddButton />}
    </Box>
  )
}
