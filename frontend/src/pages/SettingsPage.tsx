import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Link,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { PageHeader } from '../components/common/PageHeader'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import { fetchProverkachekaTokenStatus, saveProverkachekaToken } from '../api/auth'
import { messageFromError } from '../api/client'
import { colors, softBg, softFg } from '../theme'

const ROLE_LABELS: Record<string, string> = { user: 'Пользователь', admin: 'Администратор' }
const STATUS_COLORS: Record<string, string> = {
  active: colors.green,
  pending: colors.amber,
  blocked: colors.red,
}

/** Настройки — profile from the real /me endpoint + session controls. */
export function SettingsPage() {
  const theme = useTheme()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const themeMode = useUiStore((s) => s.themeMode)
  const setThemeMode = useUiStore((s) => s.setThemeMode)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // токен proverkacheka (для авто-загрузки чеков по QR)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenMsg, setTokenMsg] = useState<string | null>(null)

  useEffect(() => {
    fetchProverkachekaTokenStatus()
      .then((r) => setHasToken(r.has_token))
      .catch(() => setHasToken(false))
  }, [])

  const saveToken = async () => {
    setTokenBusy(true)
    setTokenMsg(null)
    try {
      const r = await saveProverkachekaToken(tokenInput.trim())
      setHasToken(r.has_token)
      setTokenInput('')
      setTokenMsg('Токен сохранён')
    } catch (e) {
      setTokenMsg(messageFromError(e))
    } finally {
      setTokenBusy(false)
    }
  }

  const handleLogout = async () => {
    setBusy(true)
    await logout()
    setBusy(false)
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 720 }}>
      <PageHeader title="Настройки" />

      <Card sx={{ p: 2.5 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: softBg(theme),
                color: softFg(theme),
              }}
            >
              <PersonOutlineIcon fontSize="large" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{user?.email ?? '—'}</Typography>
              <Box sx={{ display: 'flex', gap: 0.75, mt: 0.75, flexWrap: 'wrap' }}>
                <Chip size="small" label={ROLE_LABELS[user?.role ?? 'user'] ?? user?.role} variant="outlined" sx={{ height: 22, fontSize: 12 }} />
                {user && (
                  <Chip
                    size="small"
                    label={user.status}
                    sx={{ height: 22, fontSize: 12, bgcolor: `${STATUS_COLORS[user.status] ?? colors.textSecondary}1A`, color: STATUS_COLORS[user.status] ?? colors.textSecondary }}
                  />
                )}
              </Box>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Данные профиля приходят из реального эндпоинта <code>/api/v1/auth/me</code>.
          </Typography>
        </Stack>
      </Card>

      <Card sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: softBg(theme),
              color: softFg(theme),
              flexShrink: 0,
            }}
          >
            {themeMode === 'dark' ? <DarkModeOutlinedIcon /> : <LightModeOutlinedIcon />}
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Внешний вид
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {themeMode === 'dark' ? 'Тёмная тема включена' : 'Светлая тема включена'}
            </Typography>
          </Box>
          <Switch
            checked={themeMode === 'dark'}
            onChange={(e) => setThemeMode(e.target.checked ? 'dark' : 'light')}
            inputProps={{ 'aria-label': 'Переключить тёмную тему' }}
            color="primary"
          />
        </Box>
      </Card>

      <Card sx={{ p: 2.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
          Сервис чеков (proverkacheka)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Токен нужен для автоматической загрузки чека по QR-коду (POST /receipts).
          Хранится только в вашем аккаунте.
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
          <TextField
            label="Токен proverkacheka"
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && tokenInput.trim() && !tokenBusy) void saveToken()
            }}
            fullWidth
            size="small"
            placeholder={hasToken ? '•••••••• (будет заменён)' : 'Вставьте токен'}
          />
          <Button
            variant="contained"
            onClick={saveToken}
            disabled={tokenBusy || !tokenInput.trim()}
            startIcon={tokenBusy ? <CircularProgress size={16} color="inherit" /> : <ReceiptLongOutlinedIcon />}
            sx={{ height: 40, whiteSpace: 'nowrap' }}
          >
            Сохранить
          </Button>
        </Stack>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={hasToken === null ? 'Проверяем…' : hasToken ? 'Токен настроен' : 'Токен не настроен'}
            variant="outlined"
            sx={{ height: 22, fontSize: 12 }}
          />
          {tokenMsg && (
            <Typography variant="caption" color={tokenMsg === 'Токен сохранён' ? 'success.main' : 'error.main'}>
              {tokenMsg}
            </Typography>
          )}
        </Box>
      </Card>

      <Card sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', minWidth: 0 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: softBg(theme),
                color: softFg(theme),
                flexShrink: 0,
              }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 19 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                О приложении
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Как устроен учёт: периоды, дельты, баланс
              </Typography>
            </Box>
          </Stack>
          <Link
            component={RouterLink}
            to="/about"
            variant="body2"
            underline="hover"
            color="primary"
            sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
          >
            Открыть
          </Link>
        </Stack>
      </Card>

      <Card sx={{ p: 2.5, borderColor: `${colors.red}55` }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: colors.red }}>
          Выйти из аккаунта
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Токены будут удалены из cookies, сессия на сервере завершится.
        </Typography>
        {confirming ? (
          <Stack direction="row" spacing={1.5}>
            <Button variant="contained" color="error" onClick={handleLogout} disabled={busy}>
              {busy ? 'Выходим…' : 'Да, выйти'}
            </Button>
            <Button variant="outlined" onClick={() => setConfirming(false)}>
              Отмена
            </Button>
          </Stack>
        ) : (
          <Button variant="outlined" color="error" startIcon={<LogoutIcon />} onClick={() => setConfirming(true)}>
            Выйти
          </Button>
        )}
      </Card>
    </Stack>
  )
}
