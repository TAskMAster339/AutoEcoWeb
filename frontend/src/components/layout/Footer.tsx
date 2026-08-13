import { Box, Link, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

/**
 * Page footer — desktop-only (mobile keeps the bottom navigation clean).
 * Three equal columns keep the product name visually centered.
 */
export function Footer() {
  const year = new Date().getFullYear()

  return (
    <Box
      component="footer"
      sx={{
        display: { xs: 'none', md: 'grid' },
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 3,
        px: 3,
        py: 1.5,
        borderTop: '1px solid',
        borderColor: 'divider',
        color: 'text.secondary',
      }}
    >
      <Link component={RouterLink} to="/about" variant="caption" underline="hover" color="inherit" sx={{ justifySelf: 'start' }}>
        Wiki о проекте
      </Link>
      <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 700, whiteSpace: 'nowrap' }}>
        © {year} AutoEco
      </Typography>
      <Link component={RouterLink} to="/privacy" variant="caption" underline="hover" color="inherit" sx={{ justifySelf: 'end' }}>
        Политика конфиденциальности
      </Link>
    </Box>
  )
}
