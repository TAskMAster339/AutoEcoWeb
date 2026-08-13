import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Grid2 as Grid,
  Slider,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import BrightnessAutoOutlinedIcon from '@mui/icons-material/BrightnessAutoOutlined'
import LogoutIcon from '@mui/icons-material/Logout'
import PersonOutlineIcon from '@mui/icons-material/PersonOutline'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { Link as RouterLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'
import type { ThemeMode } from '../store/uiStore'
import { fetchProverkachekaTokenStatus, saveProverkachekaToken } from '../api/auth'
import { messageFromError } from '../api/client'
import { colors, softBg, softFg } from '../theme'
import { PasswordField } from '../components/common/PasswordField'

const ROLE_LABELS: Record<string, string> = { user: 'Пользователь', admin: 'Администратор' }
const STATUS_LABELS: Record<string, string> = {
  active: 'Активен',
  pending: 'Ожидает подтверждения',
  blocked: 'Заблокирован',
}
const STATUS_COLORS: Record<string, string> = {
  active: colors.green,
  pending: colors.amber,
  blocked: colors.red,
}

const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Светлая тема включена',
  dark: 'Тёмная тема включена',
  system: 'Системная тема — как на устройстве',
}

const MODE_ICONS: Record<ThemeMode, ReactNode> = {
  light: <LightModeOutlinedIcon sx={{ fontSize: 20 }} />,
  dark: <DarkModeOutlinedIcon sx={{ fontSize: 20 }} />,
  system: <BrightnessAutoOutlinedIcon sx={{ fontSize: 20 }} />,
}

/** Иконка-подложка тайла — никаких кругов. */
function TileIcon({ children }: { children: ReactNode }) {
  const theme = useTheme()
  return (
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
      {children}
    </Box>
  )
}

/** Положения ползунка: слева тёмная, по центру системная, справа светлая. */
const SLIDER_MODES: ThemeMode[] = ['dark', 'system', 'light']

const SLIDER_ARIA: Record<ThemeMode, string> = {
  dark: 'Тёмная',
  system: 'Системная',
  light: 'Светлая',
}

/** Ползунок темы с тремя положениями: тёмная / системная / светлая. */
function ThemeSlider() {
  const themeMode = useUiStore((s) => s.themeMode)
  const setThemeMode = useUiStore((s) => s.setThemeMode)
  const marks = [
    {
      value: 0,
      label: (
        <Box
          component="span"
          aria-hidden="true"
          onClick={() => setThemeMode('dark')}
          sx={{ cursor: 'pointer' }}
        >
          <DarkModeOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
      ),
    },
    {
      value: 1,
      label: (
        <Box
          component="span"
          aria-hidden="true"
          onClick={() => setThemeMode('system')}
          sx={{ cursor: 'pointer' }}
        >
          <BrightnessAutoOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
      ),
    },
    {
      value: 2,
      label: (
        <Box
          component="span"
          aria-hidden="true"
          onClick={() => setThemeMode('light')}
          sx={{ cursor: 'pointer' }}
        >
          <LightModeOutlinedIcon sx={{ fontSize: 18 }} />
        </Box>
      ),
    },
  ]
  return (
    <Slider
      min={0}
      max={2}
      step={1}
      value={Math.max(0, SLIDER_MODES.indexOf(themeMode))}
      onChange={(_, value) => setThemeMode(SLIDER_MODES[value as number]!)}
      getAriaValueText={(value) => `Тема: ${SLIDER_ARIA[SLIDER_MODES[value]!]}`}
      aria-label="Тема оформления"
      marks={marks}
      valueLabelDisplay="off"
      sx={{
        width: '100%',
        maxWidth: 280,
        mx: 'auto',
        mt: 2.5,
        mb: 4,
        color: 'primary.main',
        '& .MuiSlider-rail': { borderRadius: 4, opacity: 0.25 },
        '& .MuiSlider-track': { borderRadius: 4, border: 'none' },
        '& .MuiSlider-thumb': {
          width: 18,
          height: 18,
          borderRadius: '5px',
          boxShadow: 'none',
          '&:hover, &.Mui-focusVisible, &.Mui-active': {
            boxShadow: '0 0 0 6px rgba(108, 92, 231, 0.18)',
          },
        },
        '& .MuiSlider-mark': { display: 'none' },
        '& .MuiSlider-markLabel': {
          top: 40,
          fontSize: 18,
          lineHeight: 1,
          color: 'text.secondary',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          '&.MuiSlider-markLabelActive': { color: 'primary.main' },
        },
      }}
    />
  )
}

/** Профиль — аккаунт, оформление, сервис проверки чеков (данные из /me). */
export function ProfilePage() {
  const theme = useTheme()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const changePassword = useAuthStore((s) => s.changePassword)
  const themeMode = useUiStore((s) => s.themeMode)

  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  // ключ сервиса проверки чеков (proverkacheka)
  const [hasToken, setHasToken] = useState<boolean | null>(null)
  const [tokenInput, setTokenInput] = useState('')
  const [tokenBusy, setTokenBusy] = useState(false)
  const [tokenMsg, setTokenMsg] = useState<string | null>(null)

  // смена пароля
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwBusy, setPwBusy] = useState(false)
  const [pwMsg, setPwMsg] = useState<string | null>(null)

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
      setTokenMsg('Ключ сохранён')
    } catch (e) {
      setTokenMsg(messageFromError(e))
    } finally {
      setTokenBusy(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPw.length < 8) {
      setPwMsg('Пароль должен быть не короче 8 символов')
      return
    }
    if (confirmPw !== newPw) {
      setPwMsg('Пароли не совпадают')
      return
    }
    setPwBusy(true)
    setPwMsg(null)
    const ok = await changePassword(currentPw, newPw)
    setPwBusy(false)
    if (ok) {
      setPwMsg('Пароль изменён')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } else {
      setPwMsg(messageFromError(useAuthStore.getState().error))
    }
  }

  const handleLogout = async () => {
    setBusy(true)
    await logout()
    setBusy(false)
  }

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        {/* Аккаунт — крупный тайл */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ p: { xs: 2.5, md: 3 }, height: '100%' }}>
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 56,
                  height: 56,
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: softBg(theme),
                  color: softFg(theme),
                  flexShrink: 0,
                }}
              >
                <PersonOutlineIcon fontSize="large" />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 18, wordBreak: 'break-word' }}>
                  {user?.email ?? '—'}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={ROLE_LABELS[user?.role ?? 'user'] ?? user?.role}
                    variant="outlined"
                    sx={{ height: 24, fontSize: 12 }}
                  />
                  {user && (
                    <Chip
                      size="small"
                      label={STATUS_LABELS[user.status] ?? user.status}
                      sx={{
                        height: 24,
                        fontSize: 12,
                        bgcolor: `${STATUS_COLORS[user.status] ?? colors.textSecondary}1A`,
                        color: STATUS_COLORS[user.status] ?? colors.textSecondary,
                      }}
                    />
                  )}
                </Stack>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 1.5, lineHeight: 1.5 }}
                >
                  Аккаунт используется для входа в приложение и доступа к данным на всех
                  устройствах. Ниже можно сменить пароль, настроить оформление и подключить
                  сервис проверки чеков.
                </Typography>
              </Box>
            </Stack>
          </Card>
        </Grid>

        {/* Проверка чеков — статус ключа и объяснение про ФНС */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <TileIcon>
                <ReceiptLongOutlinedIcon sx={{ fontSize: 20 }} />
              </TileIcon>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Проверка чеков</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Данные чеков мы получаем через сервис проверки чеков — он запрашивает их напрямую
              из ФНС.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 'auto' }}>
              <Box
                sx={{
                  width: 10,
                  height: 10,
                  borderRadius: '3px',
                  flexShrink: 0,
                  bgcolor: hasToken === null ? colors.amber : hasToken ? colors.green : colors.amber,
                }}
              />
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>
                {hasToken === null
                  ? 'Проверяем ключ…'
                  : hasToken
                    ? 'Ключ подключён'
                    : 'Ключ не подключён'}
              </Typography>
            </Box>
          </Card>
        </Grid>

        {/* Ключ сервиса проверки чеков */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.25 }}>
              <TileIcon>
                <VpnKeyOutlinedIcon sx={{ fontSize: 20 }} />
              </TileIcon>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Ключ сервиса проверки чеков</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
              Ключ привязывается к вашему аккаунту и используется только для загрузки чеков по
              QR-коду. Получить его можно в личном кабинете сервиса проверки чеков
              (proverkacheka.com).
            </Typography>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start', mt: 'auto', pt: 2 }}>
              <PasswordField
                label="Ключ проверки чеков"
                autoComplete="new-password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && tokenInput.trim() && !tokenBusy) void saveToken()
                }}
                fullWidth
                size="small"
                placeholder={hasToken ? '•••••••• (будет заменён)' : 'Вставьте ключ'}
              />
              <Button
                variant="contained"
                onClick={saveToken}
                disabled={tokenBusy || !tokenInput.trim()}
                startIcon={tokenBusy ? <CircularProgress size={16} color="inherit" /> : <VpnKeyOutlinedIcon />}
                sx={{ height: 40, whiteSpace: 'nowrap', px: 3, flexShrink: 0 }}
              >
                Сохранить
              </Button>
            </Stack>
            {tokenMsg && (
              <Typography
                variant="caption"
                color={tokenMsg === 'Ключ сохранён' ? 'success.main' : 'error.main'}
                sx={{ display: 'block', mt: 1 }}
              >
                {tokenMsg}
              </Typography>
            )}
          </Card>
        </Grid>

        {/* Оформление */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <TileIcon>{MODE_ICONS[themeMode]}</TileIcon>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Оформление</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  {MODE_LABELS[themeMode]}
                </Typography>
              </Box>
            </Stack>
            <ThemeSlider />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1.5, lineHeight: 1.5 }}
            >
              Тёмная тема — слева, светлая — справа, по центру — системная: она следует за
              оформлением вашего устройства. Двигайте ползунок или нажимайте на иконку.
            </Typography>
          </Card>
        </Grid>

        {/* Смена пароля */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1.25 }}>
              <TileIcon>
                <LockOutlinedIcon sx={{ fontSize: 20 }} />
              </TileIcon>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Смена пароля</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              Пароль должен быть не короче 8 символов. После смены пароля все остальные устройства
              выйдут из аккаунта.
            </Typography>
            <Stack spacing={1.5} sx={{ mt: 1.5 }}>
              <PasswordField
                label="Текущий пароль"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !pwBusy) void handleChangePassword()
                }}
                fullWidth
                autoComplete="current-password"
              />
              <PasswordField
                label="Новый пароль"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !pwBusy) void handleChangePassword()
                }}
                fullWidth
                autoComplete="new-password"
              />
              <PasswordField
                label="Повторите новый пароль"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !pwBusy) void handleChangePassword()
                }}
                fullWidth
                autoComplete="new-password"
              />
            </Stack>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1.5, mt: 'auto', pt: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                onClick={handleChangePassword}
                disabled={pwBusy || !currentPw || !newPw || !confirmPw}
                startIcon={pwBusy ? <CircularProgress size={16} color="inherit" /> : <LockOutlinedIcon />}
              >
                Изменить пароль
              </Button>
              {pwMsg && (
                <Typography variant="caption" color={pwMsg === 'Пароль изменён' ? 'success.main' : 'error.main'}>
                  {pwMsg}
                </Typography>
              )}
            </Box>
          </Card>
        </Grid>

        {/* О приложении */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <TileIcon>
                <InfoOutlinedIcon sx={{ fontSize: 20 }} />
              </TileIcon>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>О приложении</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  Как устроен учёт: периоды, дельты, баланс
                </Typography>
              </Box>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.5 }}>
              AutoEco помогает вести учёт расходов: добавляйте чеки и транзакции, следите
              за периодами и дельтами баланса, анализируйте траты по магазинам и категориям.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.5 }}>
              Данные хранятся в вашем аккаунте и доступны на всех устройствах. Сканируйте
              QR-код чека — сведения подтянутся напрямую из ФНС через сервис проверки чеков.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.5 }}>
              По ссылке ниже — подробная вики проекта со всеми необходимыми материалами:
              документацией, инструкциями и описанием всех разделов приложения.
            </Typography>
            <Button
              component={RouterLink}
              to="/about"
              variant="contained"
              color="primary"
              sx={{ mt: 'auto', alignSelf: 'center' }}
            >
              Открыть
            </Button>
          </Card>
        </Grid>

        {/* Выход из аккаунта */}
        <Grid size={{ xs: 12 }}>
          <Card sx={{ p: 2.5, borderColor: `${colors.red}55` }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5, color: colors.red }}>
              Выйти из аккаунта
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Сессия на сервере завершится, и вам снова понадобится пароль для входа.
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
              <Button
                variant="outlined"
                color="error"
                startIcon={<LogoutIcon />}
                onClick={() => setConfirming(true)}
              >
                Выйти
              </Button>
            )}
          </Card>
        </Grid>
      </Grid>
    </Stack>
  )
}
