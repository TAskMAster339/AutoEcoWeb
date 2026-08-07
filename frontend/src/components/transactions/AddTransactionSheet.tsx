import { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined'
import { BottomSheet } from '../common/BottomSheet'
import { useUiStore } from '../../store/uiStore'
import { useTags } from '../../hooks/useTags'
import { useCreateTransaction } from '../../hooks/useTransactions'
import { todayIso } from '../../lib/format'
import { colors } from '../../theme'
import type { Tag } from '../../api/types'

const STORES = ['Дикси', 'Перекрёсток', 'Пятёрочка', 'ВкусВилл', 'Магнит', 'Яндекс Лавка', 'Метро', 'Сбережения']

interface Html5QrcodeLike {
  start: (
    facingMode: { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (text: string) => void,
    onError: (err: unknown) => void,
  ) => Promise<unknown>
  stop: () => Promise<void>
  clear: () => void
}

/** Bottom sheet: manual receipt entry with graceful QR-scan fallback. */
export function AddTransactionSheet() {
  const open = useUiStore((s) => s.addSheetOpen)
  const close = useUiStore((s) => s.closeAddSheet)
  const { data: tags } = useTags()
  const createTx = useCreateTransaction()

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [store, setStore] = useState('')
  const [date, setDate] = useState(todayIso())
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [quantity, setQuantity] = useState('')
  const [price, setPrice] = useState('')
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [formError, setFormError] = useState<string | null>(null)

  // scanner state
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const scannerRef = useRef<Html5QrcodeLike | null>(null)

  useEffect(() => {
    if (!open) {
      setScanning(false)
      setScanError(null)
      void scannerRef.current?.stop().catch(() => undefined)
      scannerRef.current = null
    }
  }, [open])

  useEffect(
    () => () => {
      void scannerRef.current?.stop().catch(() => undefined)
    },
    [],
  )

  const toggleTag = (id: string) =>
    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]))

  const applyDecodedText = (text: string) => {
    const lower = text.toLowerCase()
    const matchedStore = STORES.find((s) => lower.includes(s.toLowerCase()))
    setDescription(text.slice(0, 120))
    if (matchedStore) setStore(matchedStore)
  }

  const startScan = async () => {
    setScanError(null)
    try {
      const { Html5Qrcode } = await import('html5-qrcode')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner
      setScanning(true)
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText: string) => {
          void scanner.stop().catch(() => undefined)
          setScanning(false)
          applyDecodedText(decodedText)
        },
        () => undefined,
      )
    } catch {
      setScanning(false)
      setScanError('Не удалось запустить камеру. Добавьте чек вручную.')
    }
  }

  const submit = async () => {
    setFormError(null)
    const value = Number.parseFloat(amount.replace(',', '.'))
    if (!store.trim()) {
      setFormError('Укажите магазин')
      return
    }
    if (!description.trim() && !value) {
      setFormError('Укажите описание или сумму')
      return
    }
    const qty = quantity ? Number.parseFloat(quantity.replace(',', '.')) : null
    const unitPrice = price ? Number.parseFloat(price.replace(',', '.')) : null
    const isExpense = type === 'expense'

    try {
      await createTx.mutateAsync({
        date,
        store: store.trim(),
        description: description.trim() || 'Без описания',
        tagIds: selectedTags,
        quantity: qty,
        price: unitPrice,
        income: isExpense ? null : value || null,
        expense: isExpense ? value || null : null,
        comment: comment.trim() || null,
      })
      // reset for next time
      setStore('')
      setDescription('')
      setAmount('')
      setQuantity('')
      setPrice('')
      setComment('')
      setSelectedTags([])
      setType('expense')
      close()
    } catch {
      setFormError('Не удалось сохранить операцию')
    }
  }

  const busy = createTx.isPending

  return (
    <BottomSheet open={open} onClose={close} title={scanning ? 'Сканирование чека' : 'Добавить операцию'}>
      {scanning ? (
        <Box sx={{ textAlign: 'center' }}>
          <Box
            id="qr-reader"
            sx={{
              width: '100%',
              maxWidth: 300,
              mx: 'auto',
              borderRadius: '8px',
              overflow: 'hidden',
              '& video': { borderRadius: '8px' },
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Наведите камеру на QR-код чека
          </Typography>
          <Button sx={{ mt: 1 }} onClick={() => { setScanning(false); void scannerRef.current?.stop().catch(() => undefined) }}>
            Отмена
          </Button>
        </Box>
      ) : (
        <Stack spacing={2}>
          {scanError && <Alert severity="warning">{scanError}</Alert>}
          {formError && <Alert severity="error">{formError}</Alert>}

          <Button variant="outlined" startIcon={<QrCodeScannerOutlinedIcon />} onClick={startScan} fullWidth>
            Сканировать QR-код чека
          </Button>

          <ToggleButtonGroup
            value={type}
            exclusive
            onChange={(_, v) => v && setType(v)}
            size="small"
            fullWidth
            aria-label="Тип операции"
          >
            <ToggleButton value="expense" sx={{ flex: 1, color: colors.red }}>
              Расход
            </ToggleButton>
            <ToggleButton value="income" sx={{ flex: 1, color: colors.green }}>
              Доход
            </ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="Магазин"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            fullWidth
            required
            slotProps={{ htmlInput: { list: 'stores-list' } }}
          />
          <datalist id="stores-list">
            {STORES.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          <Stack direction="row" spacing={1.5}>
            <TextField label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
            <TextField
              label="Сумма, ₽"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              fullWidth
              placeholder="0,00"
            />
          </Stack>

          <TextField
            label="Описание"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            minRows={1}
            maxRows={3}
            placeholder="Например: Нап. Газ. Фрустайл"
          />

          <Stack direction="row" spacing={1.5}>
            <TextField label="Кол-во" value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" fullWidth placeholder="1" />
            <TextField label="Цена, ₽" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" fullWidth placeholder="139,90" />
          </Stack>

          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
              Теги
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {(tags ?? []).map((t: Tag) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  clickable
                  color={selectedTags.includes(t.id) ? 'primary' : 'default'}
                  variant={selectedTags.includes(t.id) ? 'filled' : 'outlined'}
                  onClick={() => toggleTag(t.id)}
                />
              ))}
            </Box>
          </Box>

          <TextField
            label="Комментарий"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            fullWidth
            placeholder="Необязательно"
          />

          <Button variant="contained" onClick={submit} disabled={busy} size="large" fullWidth>
            {busy ? <CircularProgress size={20} color="inherit" /> : 'Сохранить'}
          </Button>
        </Stack>
      )}
    </BottomSheet>
  )
}
