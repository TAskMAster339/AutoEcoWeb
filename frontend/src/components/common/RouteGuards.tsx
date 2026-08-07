import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { Logo } from './Logo'
import { useAuthStore } from '../../store/authStore'

/** Full-screen splash while the session is being restored from the cookie. */
export function FullPageSplash() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        bgcolor: 'background.default',
      }}
    >
      <Logo />
      <CircularProgress size={26} />
    </Box>
  )
}

/** Blocks routes until the session is restored; redirects to /login when signed out. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status)
  const location = useLocation()

  if (status === 'idle' || status === 'loading') return <FullPageSplash />
  if (status !== 'authenticated') {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return <Outlet />
}

/** /login — redirects signed-in users to the app. */
export function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status)
  if (status === 'idle' || status === 'loading') return <FullPageSplash />
  if (status === 'authenticated') return <Navigate to="/transactions" replace />
  return children
}
