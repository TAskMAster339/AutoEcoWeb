import { Box, Button } from '@mui/material'
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined'
import PlaylistAddOutlinedIcon from '@mui/icons-material/PlaylistAddOutlined'
import { BottomSheet } from './BottomSheet'
import { useUiStore } from '../../store/uiStore'

/**
 * Global «Добавить» menu, driven by the store flag addMenuOpen.
 * Opened from page empty states («Пока нет операций» / «Добавить») —
 * the FAB and the Header keep their own anchored dropdowns.
 */
export function AddMenu() {
  const open = useUiStore((s) => s.addMenuOpen)
  const close = useUiStore((s) => s.closeAddMenu)
  const openReceiptSheet = useUiStore((s) => s.openReceiptSheet)
  const openTransactionSheet = useUiStore((s) => s.openTransactionSheet)

  return (
    <BottomSheet open={open} onClose={close} title="Добавить">
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<QrCodeScannerOutlinedIcon />}
          onClick={() => {
            close()
            openReceiptSheet()
          }}
          sx={{ justifyContent: 'flex-start', py: 1.25, borderRadius: '8px' }}
        >
          Добавить чек
        </Button>
        <Button
          variant="contained"
          fullWidth
          startIcon={<PlaylistAddOutlinedIcon />}
          onClick={() => {
            close()
            openTransactionSheet()
          }}
          sx={{ justifyContent: 'flex-start', py: 1.25, borderRadius: '8px' }}
        >
          Добавить транзакцию
        </Button>
      </Box>
    </BottomSheet>
  )
}
