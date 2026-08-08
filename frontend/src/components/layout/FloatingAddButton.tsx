import { useRef, useState } from 'react'
import { Fab, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined'
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined'
import { useUiStore } from '../../store/uiStore'

/**
 * Floating «+» button — mobile entry point. Opens a menu with the two
 * interaction modes: «Добавить чек» (QR/камера) и «Добавить транзакцию».
 */
export function FloatingAddButton() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const openReceiptSheet = useUiStore((s) => s.openReceiptSheet)
  const openTransactionSheet = useUiStore((s) => s.openTransactionSheet)
  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const fabRef = useRef<HTMLButtonElement>(null)

  if (!isMobile) return null

  return (
    <>
      <Fab
        ref={fabRef}
        color="primary"
        aria-label="Добавить чек или транзакцию"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          position: 'fixed',
          right: 20,
          bottom: 88,
          zIndex: 1200,
          boxShadow: '0 8px 24px rgba(108,92,231,0.4)',
          '&:hover': { boxShadow: '0 12px 28px rgba(108,92,231,0.5)' },
        }}
      >
        <AddIcon />
      </Fab>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <MenuItem
          onClick={() => {
            setAnchor(null)
            openReceiptSheet()
          }}
        >
          <QrCodeScannerOutlinedIcon sx={{ mr: 1.5, fontSize: 20 }} /> Добавить чек
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null)
            openTransactionSheet()
          }}
        >
          <PlaylistAddOutlinedIcon sx={{ mr: 1.5, fontSize: 20 }} /> Добавить транзакцию
        </MenuItem>
      </Menu>
    </>
  )
}
