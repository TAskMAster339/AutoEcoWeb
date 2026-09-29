import { useEffect } from 'react'
import { useNavigate, useRouteError } from 'react-router-dom'
import { FatalErrorScreen, reportUiError } from './AppErrorBoundary'

export function RouteErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()

  useEffect(() => {
    reportUiError(error, 'route')
  }, [error])

  return (
    <FatalErrorScreen
      onRetry={() => navigate(0)}
      onReload={() => window.location.reload()}
    />
  )
}
