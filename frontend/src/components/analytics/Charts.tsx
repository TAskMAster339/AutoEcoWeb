import { Box, Card, Stack, Typography } from '@mui/material'
import { formatCurrency, formatShortDate } from '../../lib/format'
import { colors } from '../../theme'
import type { AnalyticsDaily } from '../../api/types'

interface BarChartProps {
  data: AnalyticsDaily[]
}

/** Hand-rolled SVG bar chart — expenses by day, purple bars (mockup style). */
export function BarChart({ data }: BarChartProps) {
  const w = 640
  const h = 220
  const pad = { top: 12, right: 8, bottom: 28, left: 8 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom

  const max = Math.max(...data.map((d) => d.expenses), 1)
  const step = innerW / Math.max(data.length, 1)
  const barW = Math.min(22, step * 0.55)

  // label every ~4th day
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Расходы по дням">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.left}
          x2={w - pad.right}
          y1={pad.top + innerH * (1 - f)}
          y2={pad.top + innerH * (1 - f)}
          stroke="#F1F1F6"
          strokeWidth={1}
        />
      ))}
      {data.map((d, i) => {
        const x = pad.left + i * step + (step - barW) / 2
        const barH = (d.expenses / max) * innerH
        const y = pad.top + innerH - barH
        return (
          <g key={d.day}>
            <rect x={x} y={y} width={barW} height={Math.max(barH, d.expenses > 0 ? 2 : 0)} rx={4} fill={d.expenses > 0 ? colors.primary : '#EDEDF4'} />
            {i % labelEvery === 0 && (
              <text x={x + barW / 2} y={h - 8} textAnchor="middle" fontSize={10} fill={colors.textSecondary}>
                {formatShortDate(d.day)}
              </text>
            )}
          </g>
        )
      })}
      <text x={pad.left} y={pad.top - 4} fontSize={10} fill={colors.textSecondary}>
        макс {formatCurrency(max)}
      </text>
    </svg>
  )
}

interface HorizontalBarsProps {
  items: Array<{ label: string; value: number; color?: string }>
}

/** Horizontal proportion bars — by store / by tag. */
export function HorizontalBars({ items }: HorizontalBarsProps) {
  const max = Math.max(...items.map((i) => i.value), 1)
  return (
    <Stack spacing={1.25}>
      {items.map((item) => (
        <Box key={item.label}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.35 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {item.label}
            </Typography>
            <Typography variant="body2" className="tnum" color="text.secondary">
              {formatCurrency(item.value)}
            </Typography>
          </Box>
          <Box sx={{ height: 8, borderRadius: 99, bgcolor: '#F1F1F6', overflow: 'hidden' }}>
            <Box
              sx={{
                width: `${(item.value / max) * 100}%`,
                height: '100%',
                borderRadius: 99,
                bgcolor: item.color ?? colors.primary,
              }}
            />
          </Box>
        </Box>
      ))}
    </Stack>
  )
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card sx={{ p: 2.5, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ mb: 1.5, fontWeight: 700 }}>
        {title}
      </Typography>
      {children}
    </Card>
  )
}
