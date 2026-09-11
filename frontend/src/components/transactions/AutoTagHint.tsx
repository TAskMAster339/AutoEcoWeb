import { Box, Typography } from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'

interface AutoTagHintProps {
  source: 'manual' | 'auto' | null
  confidence: number | null
}

export function AutoTagHint({ source, confidence }: AutoTagHintProps) {
  if (source !== 'auto') return null
  const percent = confidence === null ? null : Math.round(confidence * 100)
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 0.75,
        color: 'primary.main',
        px: 0.25,
      }}
    >
      <AutoAwesomeOutlinedIcon sx={{ fontSize: 16, mt: '1px', flexShrink: 0 }} />
      <Typography variant="caption" sx={{ lineHeight: 1.45 }}>
        Назначено автоматически{percent === null ? '' : ` · уверенность ${percent}%`}.
        {' '}Если тег неверен, замените его — исправление улучшит следующие предсказания.
      </Typography>
    </Box>
  )
}
