import { Box, LinearProgress, Stack, Typography } from '@mui/material'

export function LimitUsageBar({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const percent = limit === 0 ? 100 : Math.min(100, (used / limit) * 100)
  const reached = used >= limit
  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', mb: 0.75 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="caption" color={reached ? 'error.main' : 'text.secondary'} className="tnum">
          {used.toLocaleString('ru-RU')} / {limit.toLocaleString('ru-RU')}
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        color={reached ? 'error' : 'primary'}
        aria-label={`${label}: использовано ${used} из ${limit}`}
        sx={{ height: 6, borderRadius: '4px', bgcolor: 'action.hover' }}
      />
    </Box>
  )
}
