import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, Card, CircularProgress, Stack, TextField, Typography } from '@mui/material'
import { Logo } from '../components/common/Logo'
import { useAuthStore } from '../store/authStore'

export function EmailVerificationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const verifyEmail = useAuthStore((s) => s.verifyEmail)
  const resendVerification = useAuthStore((s) => s.resendVerification)
  const storeError = useAuthStore((s) => s.error)
  const email = searchParams.get('email') ?? ''
  const [code, setCode] = useState<string[]>(() => Array.from({ length: 6 }, () => ''))
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false)

  const submitCode = async (value: string) => {
    setError(null)
    setInfo(null)
    if (value.length !== 6) {
      setError('Введите код из 6 цифр')
      return
    }
    setBusy(true)
    const ok = await verifyEmail(email, value)
    setBusy(false)
    if (ok) {
      setVerified(true)
      setInfo('Почта подтверждена! Дождитесь активации администратором и войдите.')
    }
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
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
    const next = Array.from({ length: 6 }, (_, index) => pasted[index] ?? '')
    setCode(next)
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

  const resend = async () => {
    setError(null)
    setInfo(null)
    if (!email.includes('@')) {
      setError('Введите корректный email')
      return
    }
    setBusy(true)
    const ok = await resendVerification(email)
    setBusy(false)
    if (ok) setInfo(`Новый код отправлен на ${email}.`)
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 4, bgcolor: 'background.default' }}>
      <Card sx={{ width: '100%', maxWidth: 400, p: { xs: 3, sm: 4 }, borderRadius: '8px' }}>
        <Stack spacing={3}>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}><Logo /></Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Подтвердите почту</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Введите код из письма</Typography>
          </Box>
          {(error || storeError) && <Alert severity="error">{error ?? storeError}</Alert>}
          {info && <Alert severity="success">{info}</Alert>}
          {verified ? (
            <Button variant="contained" fullWidth onClick={() => navigate('/login', { replace: true })}>Войти</Button>
          ) : (
            <Box component="form" onSubmit={submit} noValidate>
              <Stack spacing={2}>
                <TextField label="Email" type="email" value={email} fullWidth autoComplete="email" required InputProps={{ readOnly: true }} />
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
                <Button type="submit" variant="contained" size="large" disabled={busy} fullWidth>
                  {busy ? <CircularProgress size={22} color="inherit" /> : 'Подтвердить'}
                </Button>
                <Button type="button" variant="text" disabled={busy} onClick={() => void resend()} sx={{ alignSelf: 'center' }}>
                  Отправить код снова
                </Button>
              </Stack>
            </Box>
          )}
          <Typography variant="body2" sx={{ textAlign: 'center' }}>
            <Button variant="text" onClick={() => navigate('/login', { replace: true })}>Вернуться ко входу</Button>
          </Typography>
        </Stack>
      </Card>
    </Box>
  )
}
