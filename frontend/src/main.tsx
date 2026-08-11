import { StrictMode, useEffect, useMemo, useSyncExternalStore } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import './index.css'
import { buildTheme } from './theme'
import { useUiStore } from './store/uiStore'
import App from './App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

/** Подписка на системное предпочтение темы — для режима «системная». */
function subscribePrefersDark(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

function getPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** Picks light/dark from the UI store ('system' follows the OS live) and keeps color-scheme in sync. */
function ThemedApp() {
  const themeMode = useUiStore((s) => s.themeMode)
  const systemDark = useSyncExternalStore(subscribePrefersDark, getPrefersDark)
  const effective: 'light' | 'dark' =
    themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode
  const theme = useMemo(() => buildTheme(effective), [effective])

  useEffect(() => {
    document.documentElement.style.colorScheme = effective
  }, [effective])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemedApp />
    </QueryClientProvider>
  </StrictMode>,
)
