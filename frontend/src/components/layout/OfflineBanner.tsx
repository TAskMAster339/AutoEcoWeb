import { Alert } from '@mui/material'
import WifiOffIcon from '@mui/icons-material/WifiOff'

/** Shown at the top of the app when the browser is offline. */
export function OfflineBanner() {
  return (
    <Alert
      severity="warning"
      icon={<WifiOffIcon fontSize="small" />}
      sx={{ borderRadius: 0, justifyContent: 'center', py: 0.25 }}
    >
      Нет подключения к интернету — показаны последние данные
    </Alert>
  )
}
