import { useEffect, useState } from 'react'
import { InputAdornment, TextField } from '@mui/material'
import type { CSSProperties } from 'react'
import SearchIcon from '@mui/icons-material/Search'

interface PageSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel?: string
  width?: CSSProperties['width']
  delay?: number
}

/** Keeps typing responsive and applies an expensive page search after a short pause. */
export function PageSearch({ value, onChange, placeholder, ariaLabel, width = 280, delay = 300 }: PageSearchProps) {
  const [inputValue, setInputValue] = useState(value)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    if (inputValue === value) return
    const timer = window.setTimeout(() => onChange(inputValue), delay)
    return () => window.clearTimeout(timer)
  }, [delay, inputValue, onChange, value])

  return (
    <TextField
      value={inputValue}
      onChange={(event) => setInputValue(event.target.value)}
      placeholder={placeholder}
      size="small"
      sx={{ width, maxWidth: '100%', '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ fontSize: 19, color: 'text.secondary' }} />
            </InputAdornment>
          ),
        },
      }}
      aria-label={ariaLabel ?? placeholder}
    />
  )
}
