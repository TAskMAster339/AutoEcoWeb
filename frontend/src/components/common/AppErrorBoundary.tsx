import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'

interface FatalErrorScreenProps {
  onRetry: () => void
  onReload: () => void
}

export function FatalErrorScreen({ onRetry, onReload }: FatalErrorScreenProps) {
  return (
    <Box
      role="alert"
      sx={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        bgcolor: 'background.default',
        px: 2,
      }}
    >
      <Stack alignItems="center" spacing={1.5} textAlign="center" maxWidth={420}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 44 }} />
        <Typography component="h1" variant="h5" fontWeight={700}>
          Не удалось открыть страницу
        </Typography>
        <Typography color="text.secondary">
          Произошла непредвиденная ошибка. Попробуйте ещё раз или перезагрузите приложение.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} pt={1}>
          <Button variant="contained" onClick={onRetry}>
            Попробовать снова
          </Button>
          <Button variant="outlined" onClick={onReload}>
            Перезагрузить
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}

export function reportUiError(error: unknown, source: 'application' | 'route'): void {
  const normalized = error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: 'UnknownError', message: String(error) }

  // Deliberately omit URL, component props/state and user/session data.
  console.error('[ui-error]', { source, ...normalized })
}

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  error: unknown | null
  retryKey: number
}

/** React still requires a class component for a global render error boundary. */
export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null, retryKey: 0 }

  static getDerivedStateFromError(error: unknown): Partial<AppErrorBoundaryState> {
    return { error }
  }

  componentDidCatch(error: unknown, _info: ErrorInfo): void {
    reportUiError(error, 'application')
  }

  private retry = () => {
    this.setState((state) => ({ error: null, retryKey: state.retryKey + 1 }))
  }

  render() {
    if (this.state.error) {
      return (
        <FatalErrorScreen
          onRetry={this.retry}
          onReload={() => window.location.reload()}
        />
      )
    }

    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>
  }
}
