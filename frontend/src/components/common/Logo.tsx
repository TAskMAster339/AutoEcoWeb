import { Box } from '@mui/material'

export function Logo({ compact = false, size = 34 }: { compact?: boolean; size?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        sx={{
          width: size,
          height: size,
          borderRadius: '8px',
          background: 'linear-gradient(135deg, #7C6CF0, #5A4BD1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 800,
          fontSize: Math.round(size * 0.52),
          letterSpacing: '-0.02em',
          flexShrink: 0,
          boxShadow: '0 4px 10px rgba(108,92,231,0.35)',
        }}
        aria-hidden
      >
        A
      </Box>
      {!compact && (
        <Box component="span" sx={{ fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
          AutoEco
        </Box>
      )}
    </Box>
  )
}
