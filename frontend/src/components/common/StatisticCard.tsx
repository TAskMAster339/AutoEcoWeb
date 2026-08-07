import { Box, Card, Typography } from '@mui/material'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import { colors } from '../../theme'
import { formatSignedCurrency } from '../../lib/format'

interface StatisticCardProps {
  label: string
  value: string
  /** signed delta, e.g. +8 901,24 ₽ — colored green/red automatically */
  delta?: number | null
  /** sparkline points (e.g. balance trend) */
  sparkline?: number[]
  icon?: React.ReactNode
  hint?: string
}

function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 96
  const h = 30
  if (points.length < 2) return null
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = w / (points.length - 1)
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(h - 3 - ((p - min) / span) * (h - 6)).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function StatisticCard({ label, value, delta, sparkline, icon, hint }: StatisticCardProps) {
  const deltaColor = delta === null || delta === undefined ? colors.textSecondary : delta >= 0 ? colors.green : colors.red

  return (
    <Card sx={{ p: 2.25, minWidth: 0, height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        {icon}
      </Box>

      <Typography
        className="tnum"
        sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}
      >
        {value}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1, gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
          {delta !== undefined && delta !== null && (
            <Box
              component="span"
              sx={{ display: 'inline-flex', alignItems: 'center', color: deltaColor, fontSize: 12.5, fontWeight: 700 }}
            >
              {delta >= 0 ? <TrendingUpIcon sx={{ fontSize: 15 }} /> : <TrendingDownIcon sx={{ fontSize: 15 }} />}
              {formatSignedCurrency(delta)}
            </Box>
          )}
          {hint && (
            <Typography variant="caption" color="text.secondary" noWrap>
              {hint}
            </Typography>
          )}
        </Box>
        {sparkline && <Sparkline points={sparkline} color={deltaColor} />}
      </Box>
    </Card>
  )
}
