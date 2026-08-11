import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute, FullPageSplash } from './components/common/RouteGuards'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'

// Route-level code splitting (AGENTS.md: lazy loading, route splitting).
const page = (loader: () => Promise<{ [key: string]: unknown }>, name: string) =>
  lazy(() => loader().then((m) => ({ default: m[name] as React.ComponentType })))

const TransactionsPage = page(() => import('./pages/TransactionsPage'), 'TransactionsPage')
const DashboardPage = page(() => import('./pages/DashboardPage'), 'DashboardPage')
const AnalyticsPage = page(() => import('./pages/AnalyticsPage'), 'AnalyticsPage')
const TagsPage = page(() => import('./pages/TagsPage'), 'TagsPage')
const SellersPage = page(() => import('./pages/SellersPage'), 'SellersPage')
const RulesPage = page(() => import('./pages/RulesPage'), 'RulesPage')
const DataPage = page(() => import('./pages/DataPage'), 'DataPage')
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage')
const AdminPage = page(() => import('./pages/AdminPage'), 'AdminPage')
const AboutPage = page(() => import('./pages/AboutPage'), 'AboutPage')

function suspense(element: React.ReactNode) {
  return <Suspense fallback={<FullPageSplash />}>{element}</Suspense>
}

const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <Navigate to="/transactions" replace /> },
          { path: '/transactions', element: suspense(<TransactionsPage />) },
          { path: '/dashboard', element: suspense(<DashboardPage />) },
          { path: '/analytics', element: suspense(<AnalyticsPage />) },
          { path: '/tags', element: suspense(<TagsPage />) },
          { path: '/sellers', element: suspense(<SellersPage />) },
          { path: '/rules', element: suspense(<RulesPage />) },
          { path: '/data', element: suspense(<DataPage />) },
          { path: '/profile', element: suspense(<ProfilePage />) },
          // старый путь настроек → профиль
          { path: '/settings', element: <Navigate to="/profile" replace /> },
          { path: '/admin', element: suspense(<AdminPage />) },
          { path: '/about', element: suspense(<AboutPage />) },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

/** Restores the session from the READONLY cookie once, then renders the router. */
function Bootstrap() {
  const status = useAuthStore((s) => s.status)
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  if (status === 'idle') return <FullPageSplash />
  return <RouterProvider router={router} />
}

export default function App() {
  return <Bootstrap />
}
