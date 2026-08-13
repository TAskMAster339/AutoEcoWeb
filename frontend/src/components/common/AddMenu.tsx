import { Box, Paper, Typography } from '@mui/material'
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
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Выберите, что хотите добавить
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
        <Paper
          component="button"
          type="button"
          onClick={() => {
            close()
            openReceiptSheet()
          }}
          variant="outlined"
          sx={{ minHeight: 128, p: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', textAlign: 'left', color: 'text.primary', borderRadius: '8px', cursor: 'pointer', font: 'inherit', bgcolor: 'background.paper' }}
        >
          <Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: '8px', bgcolor: 'action.hover', color: 'primary.main' }}><QrCodeScannerOutlinedIcon /></Box>
          <Box><Typography sx={{ fontWeight: 700 }}>Чек</Typography><Typography variant="caption" color="text.secondary">Сканировать QR-код</Typography></Box>
        </Paper>
        <Paper
          component="button"
          type="button"
          onClick={() => {
            close()
            openTransactionSheet()
          }}
          variant="outlined"
          sx={{ minHeight: 128, p: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'space-between', textAlign: 'left', color: 'text.primary', borderRadius: '8px', cursor: 'pointer', font: 'inherit', bgcolor: 'background.paper' }}
        >
          <Box sx={{ width: 40, height: 40, display: 'grid', placeItems: 'center', borderRadius: '8px', bgcolor: 'primary.main', color: 'primary.contrastText' }}><PlaylistAddOutlinedIcon /></Box>
          <Box><Typography sx={{ fontWeight: 700 }}>Транзакция</Typography><Typography variant="caption" color="text.secondary">Ввести вручную</Typography></Box>
        </Paper>
      </Box>
    </BottomSheet>
  )
}
