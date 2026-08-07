import { Box, Button, CircularProgress, Typography } from '@mui/material'
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import { colors } from '../../theme'

export function LoadingState({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, py: 8 }}>
      <CircularProgress size={28} sx={{ color: colors.primary }} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  )
}

interface EmptyStateProps {
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 8, textAlign: 'center' }}>
      <InboxOutlinedIcon sx={{ fontSize: 44, color: colors.textSecondary, opacity: 0.5 }} />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
          {subtitle}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" sx={{ mt: 1.5 }} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Box>
  )
}

interface ErrorStateProps {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 8, textAlign: 'center' }}>
      <ErrorOutlineIcon sx={{ fontSize: 44, color: colors.red, opacity: 0.75 }} />
      <Typography variant="body1" fontWeight={600}>
        Не удалось загрузить данные
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
        {message}
      </Typography>
      {onRetry && (
        <Button variant="outlined" sx={{ mt: 1.5 }} onClick={onRetry}>
          Попробовать снова
        </Button>
      )}
    </Box>
  )
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, py: 8, textAlign: 'center' }}>
      <WifiOffIcon sx={{ fontSize: 44, color: colors.textSecondary, opacity: 0.5 }} />
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Вы офлайн
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
        Подключитесь к интернету, чтобы обновить данные.
      </Typography>
      {onRetry && (
        <Button variant="outlined" sx={{ mt: 1.5 }} onClick={onRetry}>
          Обновить
        </Button>
      )}
    </Box>
  )
}
