import { Box, Button, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { Logo } from '../components/common/Logo'

export function NotFoundPage() {
  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        px: 2,
        bgcolor: 'background.default',
        textAlign: 'center',
      }}
    >
      <Logo />
      <Typography variant="h3" sx={{ fontWeight: 800 }}>
        404
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Такой страницы нет
      </Typography>
      <Button component={Link} to="/transactions" variant="contained">
        На главную
      </Button>
    </Box>
  )
}
