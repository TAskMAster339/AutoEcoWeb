import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { Logo } from '../components/common/Logo'
import { PasswordField } from '../components/common/PasswordField'
import { useAuthStore } from '../store/authStore'

type Mode = 'login' | 'register'

/** /login — вход, регистрация (с подтверждением почты) и восстановление пароля. */
export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)

  const error = useAuthStore((s) => s.error)
  const status = useAuthStore((s) => s.status)

  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')

  const [localError, setLocalError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const [busy, setBusy] = useState(false)

  const busyLogin = status === 'loading'

  const resetForm = (next: Mode) => {
    setMode(next)
    setLocalError(null)
    setInfo(null)

    setPassword('')
    setPassword2('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setInfo(null)
    if (!email.includes('@')) {
      setLocalError('Введите корректный email')
      return
    }
    if (mode === 'login') {
      if (password.length < 8) {
        setLocalError('Пароль должен быть не короче 8 символов')
        return
      }
      const ok = await login(email, password)
      if (ok) navigate('/transactions', { replace: true })
      return
    }
    if (mode === 'register') {
      if (password.length < 8) {
        setLocalError('Пароль должен быть не короче 8 символов')
        return
      }
      if (password !== password2) {
        setLocalError('Пароли не совпадают')
        return
      }
      setBusy(true)
      const ok = await register(email, password)
      setBusy(false)
      if (ok) {
        navigate(`/verify-email?email=${encodeURIComponent(email)}`, { replace: true })
      }
      return
    }
  }

  const titles: Record<Mode, { title: string; subtitle: string }> = {
    login: { title: 'С возвращением', subtitle: 'Войдите, чтобы продолжить' },
    register: { title: 'Создать аккаунт', subtitle: 'Регистрация займёт минуту' },

  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        bgcolor: 'background.default',
      }}
    >
      <Card sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 }, borderRadius: '8px' }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Logo />
          </Box>

          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              {titles[mode].title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {titles[mode].subtitle}
            </Typography>
          </Box>

          {(error || localError) && <Alert severity="error">{localError ?? error}</Alert>}
          {info && <Alert severity="success">{info}</Alert>}

          <Box component="form" onSubmit={submit} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                autoComplete="email"
                required
              />
              {mode === 'login' && (
                <>
                  <PasswordField
                    label="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    autoComplete="current-password"
                    required
                  />
                </>
              )}
              {mode === 'register' && (
                <>
                  <PasswordField
                    label="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    fullWidth
                    autoComplete="new-password"
                    required
                  />
                  <PasswordField
                    label="Повторите пароль"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    fullWidth
                    autoComplete="new-password"
                    required
                  />
                </>
              )}

              <Button type="submit" variant="contained" size="large" disabled={busy || busyLogin} fullWidth>
                {busy || busyLogin ? (
                  <CircularProgress size={22} color="inherit" />
                ) : mode === 'login' ? (
                  'Войти'
                ) : (
                  'Зарегистрироваться'
                )}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            {mode === 'login' ? (
              <>
                Нет аккаунта?{' '}
                <ModeSwitch onClick={() => resetForm('register')}>Зарегистрироваться</ModeSwitch>
                <Box sx={{ mt: 1 }}>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => navigate('/recover')}
                    sx={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'primary.main',
                      fontWeight: 600,
                      font: 'inherit',
                      fontSize: 13,
                    }}
                  >
                    Забыли пароль?
                  </Box>
                </Box>
              </>
            ) : (
              <>
                Уже есть аккаунт? <ModeSwitch onClick={() => resetForm('login')}>Войти</ModeSwitch>
              </>
            )}
          </Typography>
        </Stack>
      </Card>
    </Box>
  )
}

function ModeSwitch({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        color: 'primary.main',
        fontWeight: 700,
        font: 'inherit',
        textDecoration: 'underline',
        textUnderlineOffset: 3,
      }}
    >
      {children}
    </Box>
  )
}
