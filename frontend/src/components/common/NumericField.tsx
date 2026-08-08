import {
  IconButton,
  InputAdornment,
  TextField,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'

/** Парс числа с запятой/точкой; NaN если пусто/бито. */
export function parseNum(raw: string): number {
  return Number.parseFloat(raw.replace(',', '.'))
}

/**
 * Числовое поле с фиолетовыми кнопками «− / +».
 * Ввод фильтруется: только цифры, один десятичный разделитель (`.`/`,`),
 * максимум 2 знака после запятой.
 * type="text" + inputMode="decimal" — у type="number" браузер сам ломает
 * дробный ввод (незаконченное «139.» схлопывается) и пропускает e/знаки.
 */
export function NumericField(props: {
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
