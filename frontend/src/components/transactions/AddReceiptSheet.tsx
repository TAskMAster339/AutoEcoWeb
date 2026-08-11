import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import { BottomSheet } from '../common/BottomSheet'
import { useUiStore } from '../../store/uiStore'
import { createReceiptFromQr } from '../../api/receipts'
import { messageFromError } from '../../api/client'
import { useQueryClient } from '@tanstack/react-query'

interface Html5QrcodeLike {
  start: (
    facingMode: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (text: string) => void,
    onError: (err: unknown) => void,
  ) => Promise<unknown>
  stop: () => Promise<void>
  clear: () => void
  /** true, пока камера активно сканирует */
  isScanning: boolean
}

/**
 * Bottom sheet «Добавить чек»: камера В ПРИОРИТЕТЕ (запускается сразу),
 * ручной ввод QR — запасной вариант. POST /api/v1/receipts (proverkacheka;
 * нужен ключ — см. Профиль → «Ключ сервиса проверки чеков»).
 */
export function AddReceiptSheet() {
  const open = useUiStore((s) => s.receiptSheetOpen)
  const close = useUiStore((s) => s.closeReceiptSheet)
  const queryClient = useQueryClient()

  const [manualMode, setManualMode] = useState(false)
  const [qrText, setQrText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const scannerRef = useRef<Html5QrcodeLike | null>(null)

  const invalidateDomain = () => {
    void queryClient.invalidateQueries({ queryKey: ['receipts'] })
    void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    void queryClient.invalidateQueries({ queryKey: ['summary'] })
    void queryClient.invalidateQueries({ queryKey: ['analytics'] })
    void queryClient.invalidateQueries({ queryKey: ['tags'] })
  }

  const stopScanner = () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (!scanner) return
    try {
      // html5-qrcode кидает синхронный throw, если сканер не запущен
      if (scanner.isScanning) {
        void scanner.stop().catch(() => undefined)
      }
    } catch {
      // сканер уже остановлен/не запускался — игнорируем
    }
  }

  const startCamera = async () => {
    setError(null)
    setManualMode(false)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader-receipt')
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          stopScanner()
          void saveFromQr(decodedText)
        },
        () => undefined,
      )
    } catch {
      // камера недоступна — предлагаем ручной ввод QR
      setError('Не удалось запустить камеру. Введите QR-код вручную.')
      setManualMode(true)
    }
  }

  // камера в приоритете: при открытии сразу запускаем сканер
  useEffect(() => {
    if (!open) {
      setManualMode(false)
      setQrText('')
      setError(null)
      setBusy(false)
      stopScanner()
      return
    }
    void startCamera()
    return () => {
      stopScanner()
    }
  }, [open])

  const saveFromQr = async (qr: string) => {
    setError(null)
    setBusy(true)
    try {
      await createReceiptFromQr({ qr: qr.trim() })
      invalidateDomain()
      setBusy(false)
      close()
    } catch (e) {
      setError(messageFromError(e))
      setBusy(false)
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title="Добавить чек">
      {!manualMode ? (
        <Stack spacing={1.5} sx={{ textAlign: 'center' }}>
          <Box
            id="qr-reader-receipt"
            sx={{
              width: '100%',
              maxWidth: 300,
              mx: 'auto',
              borderRadius: '8px',
              overflow: 'hidden',
              '& video': { borderRadius: '8px' },
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Наведите камеру на QR-код чека
          </Typography>
          <Button
            startIcon={<KeyboardIcon />}
            onClick={() => {
              stopScanner()
              setManualMode(true)
            }}
          >
            Ввести QR вручную
          </Button>
          {error && <Alert severity="warning">{error}</Alert>}
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'center' }}>
            <QrCodeScannerOutlinedIcon sx={{ color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              Вставьте содержимое QR-кода чека
            </Typography>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            label="QR-код (raw)"
            value={qrText}
            onChange={(e) => setQrText(e.target.value)}
            fullWidth
            multiline
            minRows={3}
            placeholder="t=20250101T1200&s=9999.99&fn=…"
          />
          <Button
            variant="contained"
            size="large"
            fullWidth
            disabled={busy || !qrText.trim()}
            onClick={() => void saveFromQr(qrText)}
          >
            {busy ? <CircularProgress size={20} color="inherit" /> : 'Загрузить чек'}
          </Button>
          <Button onClick={() => void startCamera()}>
            Включить камеру
          </Button>
        </Stack>
      )}
    </BottomSheet>
  )
}
