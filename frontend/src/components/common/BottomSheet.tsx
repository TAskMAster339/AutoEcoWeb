import type { ReactNode } from 'react'
import { Box, Drawer, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: number
}

/** Mobile-first bottom sheet (rounded top, drag-free, Esc/backdrop closes). */
export function BottomSheet({ open, onClose, title, children, maxWidth = 640 }: BottomSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // Не возвращаем фокус на кнопку-триггер после закрытия: иначе MUI
      // оставляет на ней focus-visible подсветку после Enter/клика.
      disableRestoreFocus
      slotProps={{
        paper: {
          sx: {
            maxWidth,
            width: '100%',
            mx: 'auto',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            px: { xs: 2, sm: 3 },
            py: 2,
            pb: 4,
            maxHeight: '92dvh',
            overflowY: 'auto',
          },
        },
      }}
      aria-label={title}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6">{title}</Typography>
        <IconButton onClick={onClose} aria-label="Закрыть" size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      {children}
    </Drawer>
  )
}
