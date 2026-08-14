import { lazy, Suspense, useEffect } from 'react'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ProtectedRoute, PublicOnlyRoute, FullPageSplash, VerifiedAccessRoute } from './components/common/RouteGuards'
import { useAuthStore } from './store/authStore'
import { LoginPage } from './pages/LoginPage'
import { RecoveryPage } from './pages/RecoveryPage'
import { EmailVerificationPage } from './pages/EmailVerificationPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SeoMeta } from './components/common/SeoMeta'

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
const ReceiptDetailPage = page(() => import('./pages/ReceiptDetailPage'), 'ReceiptDetailPage')
const ProfilePage = page(() => import('./pages/ProfilePage'), 'ProfilePage')
const AdminPage = page(() => import('./pages/AdminPage'), 'AdminPage')
const AboutPage = page(() => import('./pages/AboutPage'), 'AboutPage')
const PrivacyPolicyPage = page(() => import('./pages/PrivacyPolicyPage'), 'PrivacyPolicyPage')
const FeedbackPage = page(() => import('./pages/FeedbackPage'), 'FeedbackPage')

function suspense(element: React.ReactNode) {
    return <Suspense fallback={<FullPageSplash />}>{element}</Suspense>
}

function withSeo(element: React.ReactNode) {
    return <><SeoMeta />{element}</>
}

const router = createBrowserRouter([
    {
        path: '/login',
        element: withSeo(
            <PublicOnlyRoute>
                <LoginPage />
            </PublicOnlyRoute>,
        ),
    },
    {
        path: '/recover',
        element: withSeo(
            <PublicOnlyRoute>
                <RecoveryPage />
            </PublicOnlyRoute>,
        ),
    },
    {
        path: '/verify-email',
        element: withSeo(
            <PublicOnlyRoute>
                <EmailVerificationPage />
            </PublicOnlyRoute>,
        ),
    },
    { path: '/privacy', element: withSeo(suspense(<PrivacyPolicyPage />)) },
    {
        element: <ProtectedRoute />,
        children: [
            {
                element: withSeo(<AppShell />),
                children: [
                    {
                        element: <VerifiedAccessRoute />,
                        children: [
                            { path: '/', element: <Navigate to="/transactions" replace /> },
                            { path: '/transactions', element: suspense(<TransactionsPage />) },
                            { path: '/receipt', element: suspense(<DashboardPage />) },
                            { path: '/dashboard', element: <Navigate to="/receipt" replace /> },
                            { path: '/analytics', element: suspense(<AnalyticsPage />) },
                            { path: '/tags', element: suspense(<TagsPage />) },
                            { path: '/sellers', element: suspense(<SellersPage />) },
                            { path: '/rules', element: suspense(<RulesPage />) },
                            { path: '/data', element: suspense(<DataPage />) },
                            { path: '/receipts/:id', element: suspense(<ReceiptDetailPage />) },
                            { path: '/profile', element: suspense(<ProfilePage />) },
                            // старый путь настроек → профиль
                            { path: '/settings', element: <Navigate to="/profile" replace /> },
                            { path: '/admin', element: suspense(<AdminPage />) },
                            { path: '/about', element: suspense(<AboutPage />) },
                            { path: '/about/:topic', element: suspense(<AboutPage />) },
                            { path: '/feedback', element: suspense(<FeedbackPage />) },
                        ],
                    },
                ],
            },
        ],
    },
    { path: '*', element: withSeo(<NotFoundPage />) },
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
