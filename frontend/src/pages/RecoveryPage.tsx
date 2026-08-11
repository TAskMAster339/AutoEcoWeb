import { useRef, useState } from 'react'
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
import * as authApi from '../api/auth'
import { messageFromError } from '../api/client'
import { Logo } from '../components/common/Logo'
import { PasswordField } from '../components/common/PasswordField'

type Step = 'email' | 'code' | 'password' | 'done'

/** /recover — восстановление пароля по коду из письма (4 шага). */
export function RecoveryPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState<string[]>(() => Array.from({ length: 6 }, () => ''))
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<unknown>) => {
    setError(null)
    setBusy(true)
    try {
      await action()
      return true
    } catch (err) {
      setError(messageFromError(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  const requestCode = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.includes('@')) {
      setError('Введите корректный email')
      return
    }
    void run(() => authApi.requestPasswordRecovery(email)).then((ok) => {
      if (ok) setStep('code')
    })
  }

  const submitCode = async (value: string) => {
    setError(null)
    if (value.length !== 6) {
      setError('Введите код из 6 цифр')
      return
    }
    const ok = await run(() => authApi.verifyRecoveryCode(email, value))
    if (ok) setStep('password')
  }

  const checkCode = (e: React.FormEvent) => {
    e.preventDefault()
    void submitCode(code.join(''))
  }

  const updateCode = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[index] = digit
    setCode(next)
    if (digit && index < 5) codeInputRefs.current[index + 1]?.focus()
  }

  const pasteCode = (event: React.ClipboardEvent) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    setCode(Array.from({ length: 6 }, (_, index) => pasted[index] ?? ''))
    const lastIndex = Math.min(pasted.length, 6) - 1
    codeInputRefs.current[lastIndex]?.focus()
    if (pasted.length === 6) void submitCode(pasted)
  }

  const handleCodeKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === 'Backspace' && !code[index] && index > 0) {
      event.preventDefault()
      codeInputRefs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      codeInputRefs.current[index - 1]?.focus()
    } else if (event.key === 'ArrowRight' && index < 5) {
      event.preventDefault()
      codeInputRefs.current[index + 1]?.focus()
    }
  }

  const resetPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      setError('Пароль должен быть не короче 8 символов')
      return
    }
    if (password !== password2) {
      setError('Пароли не совпадают')
      return
    }
    void run(() => authApi.resetPassword(email, code.join(''), password)).then((ok) => {
      if (ok) setStep('done')
    })
  }

  const stepTitles: Record<Step, { title: string; subtitle: string }> = {
    email: { title: 'Восстановление пароля', subtitle: 'Укажите почту — отправим код' },
    code: { title: 'Код из письма', subtitle: `Мы отправили код на ${email}` },
    password: { title: 'Новый пароль', subtitle: 'Код подтверждён — задайте новый пароль' },
    done: { title: 'Готово', subtitle: 'Пароль изменён' },
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
              {stepTitles[step].title}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {stepTitles[step].subtitle}
            </Typography>
          </Box>

          {error && <Alert severity="error">{error}</Alert>}

          {step === 'done' ? (
            <Stack spacing={2}>
              <Alert severity="success">
                Пароль изменён. Все сессии завершены — войдите с новым паролем.
              </Alert>
              <Button variant="contained" size="large" fullWidth onClick={() => navigate('/login')}>
                Войти
              </Button>
            </Stack>
          ) : (
            <Box component="form" onSubmit={step === 'email' ? requestCode : step === 'code' ? checkCode : resetPassword} noValidate>
              <Stack spacing={2}>
                {step === 'email' && (
                  <TextField
                    label="Email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    fullWidth
                    autoComplete="email"
                    required
                  />
                )}
                {step === 'code' && (
                  <Box>
                    <Typography component="label" variant="body2" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                      Код из письма
                    </Typography>
                    <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} justifyContent="center">
                      {code.map((digit, index) => (
                        <TextField
                          key={index}
                          value={digit}
                          inputRef={(element: HTMLInputElement | null) => { codeInputRefs.current[index] = element }}
                          onChange={(event) => updateCode(index, event.target.value)}
                          onPaste={pasteCode}
                          onKeyDown={(event) => handleCodeKeyDown(event, index)}
                          inputProps={{ inputMode: 'numeric', pattern: '[0-9]', maxLength: 1, 'aria-label': `Цифра ${index + 1} из 6`, autoComplete: index === 0 ? 'one-time-code' : 'off' }}
                          sx={{ width: { xs: 40, sm: 48 }, '& input': { textAlign: 'center', p: { xs: 1, sm: 1.25 }, fontSize: 22, fontWeight: 700 } }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}
                {step === 'password' && (
                  <>
                    <PasswordField
                      label="Новый пароль"
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
                <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
                  {busy ? (
                    <CircularProgress size={22} color="inherit" />
                  ) : step === 'email' ? (
                    'Отправить код'
                  ) : step === 'code' ? (
                    'Проверить код'
                  ) : (
                    'Сохранить пароль'
                  )}
                </Button>
                {step !== 'email' && (
                  <Button type="button" variant="text" disabled={busy} onClick={() => setStep(step === 'password' ? 'code' : 'email')}>
                    Назад
                  </Button>
                )}
              </Stack>
            </Box>
          )}

          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            Вспомнили пароль?{' '}
            <Box
              component="button"
              type="button"
              onClick={() => navigate('/login')}
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
              Войти
            </Box>
          </Typography>
        </Stack>
      </Card>
    </Box>
  )
}
