import { Fab, useMediaQuery, useTheme } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { useUiStore } from '../../store/uiStore'

/** Floating «+» button — mobile-first entry point for adding a receipt. */
export function FloatingAddButton() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const openAddSheet = useUiStore((s) => s.openAddSheet)

  if (!isMobile) return null

  return (
    <Fab
      color="primary"
      aria-label="Добавить чек"
      onClick={openAddSheet}
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
  )
}
