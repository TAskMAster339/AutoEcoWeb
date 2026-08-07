import { Box, Tooltip } from '@mui/material'
import { colors } from '../../theme'
import { formatPercent } from '../../lib/format'
import type { PriceStatus } from '../../api/types'

function colorFor(status: PriceStatus): string {
  if (status.direction === 'down') return colors.green
  if (status.direction === 'up') return status.percent >= 5 ? colors.red : colors.amber
  return colors.textSecondary
}

/** Price-change percent.
 *  variant 'pill' (cards): colored filled badge with the percent;
 *  variant 'dot' (table mockup): colored dot + plain percent text. */
export function PriceStatusBadge({
  status,
  variant = 'pill',
}: {
  status: PriceStatus | null
  variant?: 'pill' | 'dot'
}) {
  if (!status)
    return (
      <Box component="span" aria-label="Нет данных" sx={{ color: 'text.secondary' }}>
        —
      </Box>
    )

  const color = colorFor(status)
  const label =
    status.direction === 'down'
      ? `Цена снизилась на ${Math.abs(status.percent)}%`
      : status.direction === 'up'
        ? `Цена выросла на ${status.percent}%`
        : 'Цена не изменилась'

  if (variant === 'dot') {
    return (
      <Tooltip title={label}>
        <Box
          component="span"
          className="tnum"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            fontSize: 13,
            fontWeight: 500,
            color: 'text.primary',
          }}
        >
          <Box
            component="span"
            sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color, flexShrink: 0 }}
          />
          {formatPercent(status.percent)}
        </Box>
      </Tooltip>
    )
  }

  return (
    <Tooltip title={label}>
      <Box
        className="tnum"
        component="span"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          minWidth: 44,
          px: 0.75,
          height: 26,
          borderRadius: 6,
          bgcolor: `${color}1A`,
          color,
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        {formatPercent(status.percent)}
      </Box>
    </Tooltip>
  )
}
