import type { ReactNode } from 'react'
import { Box, Drawer, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: number
  maxHeight?: string | number
  height?: string | number
}

/** Mobile-first bottom sheet (rounded top, drag-free, Esc/backdrop closes). */
export function BottomSheet({ open, onClose, title, children, maxWidth = 640, maxHeight, height }: BottomSheetProps) {
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
            px: { xs: 1.5, sm: 3 },
            pt: 1.25,
            pb: 'calc(20px + env(safe-area-inset-bottom))',
            maxHeight: maxHeight ?? { xs: 'calc(100dvh - 8px)', sm: '92dvh' },
            height,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
          },
        },
      }}
      aria-label={title}
    >
      <Box sx={{ position: 'sticky', top: -10, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, py: 0.75, bgcolor: 'background.paper' }}>
        <Typography variant="h6">{title}</Typography>
        <IconButton onClick={onClose} aria-label="Закрыть" size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      {children}
    </Drawer>
  )
}
