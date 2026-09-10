import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
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
        void queryClient.invalidateQueries({ queryKey: ['tags-page'] })
        void queryClient.invalidateQueries({ queryKey: ['user-limits'] })
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

    const handleManualKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!busy) close()
            return
        }
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        event.preventDefault()
        event.stopPropagation()
        if (!busy && qrText.trim()) void saveFromQr(qrText)
    }

    return (
        <BottomSheet open={open} onClose={close} title="Сканирование чека" maxWidth={520}>
            {!manualMode ? (
                <Stack spacing={1.5}>
                    <Card sx={{ position: 'relative', width: '100%', aspectRatio: { xs: '4 / 5', sm: '4 / 3' }, minHeight: 300, overflow: 'hidden', bgcolor: '#0b0b0f', borderColor: 'transparent' }}>
                        <Box
                            id="qr-reader-receipt"
                            sx={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                '& > div': { border: 'none !important', height: '100%' },
                                '& video': { width: '100% !important', height: '100% !important', objectFit: 'cover', borderRadius: 0 },
                                '& img': { display: 'none' },
                            }}
                        />
                        <Box aria-hidden sx={{ position: 'absolute', inset: '50% auto auto 50%', width: { xs: 210, sm: 230 }, height: { xs: 210, sm: 230 }, transform: 'translate(-50%, -50%)', border: '2px solid rgba(255,255,255,0.9)', borderRadius: '8px', boxShadow: '0 0 0 999px rgba(0,0,0,0.38)', pointerEvents: 'none' }} />
                        <Box sx={{ position: 'absolute', left: 12, right: 12, bottom: 12, p: 1.25, borderRadius: '8px', bgcolor: 'rgba(12,12,16,0.72)', color: '#fff', backdropFilter: 'blur(8px)', textAlign: 'center', pointerEvents: 'none' }}>
                            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Поместите QR-код в рамку</Typography>
                            <Typography sx={{ fontSize: 11.5, opacity: 0.75 }}>Чек загрузится автоматически</Typography>
                        </Box>
                    </Card>
                    {busy && <Alert severity="info" icon={<CircularProgress size={18} />}>Загружаем данные чека…</Alert>}
                    {error && <Alert severity="warning">{error}</Alert>}
                    <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<KeyboardIcon />}
                        onClick={() => {
                            stopScanner()
                            setManualMode(true)
                        }}
                    >
                        Ввести QR вручную
                    </Button>
                </Stack>
            ) : (
                <Stack spacing={2} onKeyDown={handleManualKeyDown}>
                    <Card sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, bgcolor: 'action.hover' }}>
                        <Box sx={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '8px', bgcolor: 'background.paper', color: 'primary.main' }}><QrCodeScannerOutlinedIcon /></Box>
                        <Box><Typography sx={{ fontWeight: 700, fontSize: 14 }}>Ручной ввод</Typography><Typography variant="caption" color="text.secondary">Вставьте строку из QR-кода</Typography></Box>
                    </Card>
                    {error && <Alert severity="warning">{error}</Alert>}
                    <TextField
                        label="QR-код (raw)"
                        value={qrText}
                        onChange={(e) => setQrText(e.target.value)}
                        fullWidth
                        multiline
                        minRows={4}
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
                    <Button variant="outlined" color="inherit" startIcon={<QrCodeScannerOutlinedIcon />} onClick={() => void startCamera()}>
                        Включить камеру
                    </Button>
                </Stack>
            )}
        </BottomSheet>
    )
}
