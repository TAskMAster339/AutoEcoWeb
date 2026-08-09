import { Box, Link, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

/**
 * Page footer — desktop-only (mobile keeps the bottom navigation clean).
 */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <Box
      component="footer"
      sx={{
        display: { xs: 'none', md: 'flex' },
        alignItems: 'center',
        gap: 2,
        px: 3,
        py: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        color: 'text.secondary',
        flexWrap: 'wrap',
      }}
    >
      <Typography variant="caption">© {year} AutoEco — учёт чеков и расходов</Typography>
      <Box sx={{ flex: 1 }} />
      <Typography variant="caption">v0.1.0</Typography>
      <Link component={RouterLink} to="/settings" variant="caption" underline="hover" color="inherit">
        Настройки
      </Link>
      <Link component={RouterLink} to="/about" variant="caption" underline="hover" color="inherit">
        О приложении
      </Link>
    </Box>
  )
}
