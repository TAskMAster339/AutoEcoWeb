import { useState } from 'react'
import type { TextFieldProps } from '@mui/material'
import { IconButton, InputAdornment, TextField } from '@mui/material'
import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'

/**
 * Поле пароля с маскировкой и квадратной кнопкой-глазиком показа/скрытия ввода.
 * Принимает все пропсы TextField (label, autoComplete, onKeyDown и т.д.).
 */
export function PasswordField(props: TextFieldProps) {
  const [show, setShow] = useState(false)
  return (
    <TextField
      {...props}
      type={show ? 'text' : 'password'}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                color="primary"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? 'Скрыть ввод' : 'Показать ввод'}
                edge="end"
                sx={{ p: 0.5, borderRadius: '6px' }}
              >
                {show ? (
                  <VisibilityOffOutlinedIcon fontSize="small" />
                ) : (
                  <VisibilityOutlinedIcon fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  )
}
