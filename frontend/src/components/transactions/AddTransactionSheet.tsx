import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import { BottomSheet } from '../common/BottomSheet'
import { useUiStore } from '../../store/uiStore'
import { useTags } from '../../hooks/useTags'
import { useCreateTransaction } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { todayIso } from '../../lib/format'
import { colors } from '../../theme'

/** Парс числа с запятой/точкой; NaN если пусто/бито. */
function parseNum(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'))
}

/**
 * Числовое поле с фиолетовыми кнопками «− / +».
 * Ввод фильтруется: только цифры, один десятичный разделитель (`.`/`,`),
 * максимум 2 знака после запятой.
 * type="text" + inputMode="decimal" — у type="number" браузер сам ломает
 * дробный ввод (незаконченное «139.» схлопывается) и пропускает e/знаки.
 */
function NumericField(props: {
  label: string
  value: string
  onChange: (v: string) => void
  required?: boolean
  placeholder?: string
  step?: number
  min?: number
  readOnly?: boolean
  error?: boolean
  helperText?: string
}) {
  const { label, value, onChange, required, placeholder, step = 1, min, readOnly, error, helperText } = props

  const bump = (dir: 1 | -1) => {
    if (readOnly || value === '') return
    const cur = parseNum(value)
    if (!Number.isFinite(cur)) return
    const next = Math.round((cur + dir * step) * 100) / 100
    if (min !== undefined && next < min) return
    onChange(String(next))
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) return
    // запятая → точка, остаются только цифры и максимум один разделитель
    const raw = e.target.value.replace(',', '.')
    let v = raw.replace(/[^\d.]/g, '')
    const firstDot = v.indexOf('.')
    if (firstDot !== -1) {
      const intPart = v.slice(0, firstDot)
      const fracPart = v.slice(firstDot + 1).replace(/\./g, '').slice(0, 2)
      v = intPart + '.' + fracPart
    }
    onChange(v)
  }

  return (
    <TextField
      label={label}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={handleInput}
      required={required}
      placeholder={placeholder}
      fullWidth
      error={error}
      helperText={helperText}
      slotProps={{
        inputLabel: { shrink: true },
        input: {
          readOnly,
          startAdornment: (
            <InputAdornment position="start">
              <IconButton
                size="small"
                color="primary"
                onClick={() => bump(-1)}
                aria-label={`Уменьшить ${label}`}
                disabled={readOnly}
                sx={{ p: 0.5, borderRadius: '6px' }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                color="primary"
                onClick={() => bump(1)}
                aria-label={`Увеличить ${label}`}
                disabled={readOnly}
                sx={{ p: 0.5, borderRadius: '6px' }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}

/**
 * Bottom sheet: ручная транзакция БЕЗ чека — минимальная единица учёта.
 * POST /api/v1/transactions (receipt_id = null). Сумма вычисляется
 * автоматически: цена (обязательная) × количество (по умолчанию 1).
 */
export function AddTransactionSheet() {
  const open = useUiStore((s) => s.transactionSheetOpen)
  const close = useUiStore((s) => s.closeTransactionSheet)
  const { data: tags } = useTags()
  const createTx = useCreateTransaction()

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [date, setDate] = useState(todayIso())
  const [name, setName] = useState('')
  const [store, setStore] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const resetForm = () => {
    setName('')
    setStore('')
    setPrice('')
    setQuantity('1')
    setSelectedTag(null)
    setType('expense')
    setFormError(null)
  }

  useEffect(() => {
    if (!open) resetForm()
  }, [open])

  // сумма = цена × количество (автоматически, с округлением до копеек)
  const priceNum = price ? parseNum(price) : NaN
  const qtyNum = quantity ? parseNum(quantity) : NaN
  const computedAmount =
    Number.isFinite(priceNum) && Number.isFinite(qtyNum)
      ? Math.round(priceNum * qtyNum * 100) / 100
      : null
  const amountText =
    computedAmount !== null ? computedAmount.toFixed(2).replace('.', ',') : ''

  const submit = async () => {
    setFormError(null)

    if (!name.trim()) {
      setFormError('Укажите название транзакции')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setFormError('Укажите цену больше нуля')
      return
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setFormError('Количество должно быть больше нуля')
      return
    }

    try {
      await createTx.mutateAsync({
        name: name.trim(),
        seller_name: store.trim() || null,
        amount: computedAmount!,
        quantity: qtyNum,
        price: priceNum,
        // полдень UTC — чтобы дата не «уезжала» ни в одном часовом поясе
        datetime: `${date}T12:00:00Z`,
        operation_type: type === 'income' ? 2 : 1,
        tag_id: selectedTag,
      })
      close()
    } catch (e) {
      setFormError(messageFromError(e))
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title="Новая транзакция">
      <Stack spacing={2}>
        {formError && <Alert severity="error">{formError}</Alert>}

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
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
          required
          autoFocus
          placeholder="Например: Кофе, проезд, зарплата"
        />

        <TextField
          label="Магазин (необязательно)"
          value={store}
          onChange={(e) => setStore(e.target.value)}
          fullWidth
          placeholder="Например: Пятёрочка, Дикси, Метро"
        />

        <Stack direction="row" spacing={1.5}>
          <NumericField
            label="Цена, ₽"
            value={price}
            onChange={setPrice}
            required
            min={0.01}
            step={1}
            placeholder="139,90"
            error={price !== '' && (!Number.isFinite(priceNum) || priceNum <= 0)}
            helperText={price !== '' && (!Number.isFinite(priceNum) || priceNum <= 0) ? 'Цена должна быть больше 0' : ' '}
          />
          <NumericField
            label="Кол-во"
            value={quantity}
            onChange={setQuantity}
            min={1}
            step={1}
            placeholder="1"
            error={quantity !== '' && (!Number.isFinite(qtyNum) || qtyNum <= 0)}
            helperText={quantity !== '' && (!Number.isFinite(qtyNum) || qtyNum <= 0) ? 'Кол-во должно быть больше 0' : ' '}
          />
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <TextField label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
          <TextField
            label="Сумма, ₽"
            value={amountText}
            fullWidth
            slotProps={{ input: { readOnly: true } }}
            placeholder="—"
            helperText="Считается автоматически"
          />
        </Stack>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Тег
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {(tags ?? []).map((t) => (
              <Chip
                key={t.id}
                label={t.name}
                clickable
                color={selectedTag === t.id ? 'primary' : 'default'}
                variant={selectedTag === t.id ? 'filled' : 'outlined'}
                onClick={() => setSelectedTag((prev) => (prev === t.id ? null : t.id))}
              />
            ))}
          </Box>
        </Box>

        <Button variant="contained" onClick={submit} disabled={createTx.isPending} size="large" fullWidth>
          {createTx.isPending ? <CircularProgress size={20} color="inherit" /> : 'Сохранить'}
        </Button>
      </Stack>
    </BottomSheet>
  )
}
