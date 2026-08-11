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

/** /login — sign in or register (register auto-signs-in). */
export function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const error = useAuthStore((s) => s.error)
  const status = useAuthStore((s) => s.status)

  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const busy = status === 'loading'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (!email.includes('@')) {
      setLocalError('Введите корректный email')
      return
    }
    if (password.length < 8) {
      setLocalError('Пароль должен быть не короче 8 символов')
      return
    }
    if (mode === 'register' && password !== password2) {
      setLocalError('Пароли не совпадают')
      return
    }
    const ok = mode === 'login' ? await login(email, password) : await register(email, password)
    if (ok) navigate('/transactions', { replace: true })
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
              {mode === 'login' ? 'С возвращением' : 'Создать аккаунт'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {mode === 'login' ? 'Войдите, чтобы продолжить' : 'Регистрация займёт минуту'}
            </Typography>
          </Box>

          {(error || localError) && <Alert severity="error">{localError ?? error}</Alert>}

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
              <PasswordField
                label="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                fullWidth
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
              />
              {mode === 'register' && (
                <PasswordField
                  label="Повторите пароль"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  fullWidth
                  autoComplete="new-password"
                  required
                />
              )}
              <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
                {busy ? <CircularProgress size={22} color="inherit" /> : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </Button>
            </Stack>
          </Box>

          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <Box
              component="button"
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setLocalError(null)
              }}
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
              {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
            </Box>
          </Typography>
        </Stack>
      </Card>
    </Box>
  )
}
