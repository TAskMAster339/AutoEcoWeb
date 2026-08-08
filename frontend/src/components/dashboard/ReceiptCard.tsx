import { useState } from 'react'
import {
  Box,
  Card,
  Chip,
  Collapse,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatLongDate } from '../../lib/format'
import { colors } from '../../theme'
import type { Receipt } from '../../lib/receipts'
import type { Tag } from '../../api/types'

interface ReceiptCardProps {
  receipt: Receipt
  tagsMap: Map<string, Tag>
}

/** Receipt summary card — expandable to line items. */
export function ReceiptCard({ receipt, tagsMap }: ReceiptCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const tags = receipt.tagIds.map((id) => tagsMap.get(id)).filter((t): t is Tag => Boolean(t))

  return (
    <Card sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            fontWeight: 800,
            color: '#fff',
            bgcolor: receipt.isIncome ? colors.green : colors.primary,
            flexShrink: 0,
          }}
          aria-hidden
        >
          {receipt.store.charAt(0).toUpperCase()}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{receipt.store}</Typography>
          <Typography variant="caption" color="text.secondary">
            {formatLongDate(receipt.date)} · {receipt.items.length} поз.
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography
            className="tnum"
            sx={{ fontWeight: 700, fontSize: 15, color: receipt.isIncome ? colors.green : colors.red }}
          >
            {receipt.isIncome ? '+' : '−'}
            {formatCurrency(Math.abs(receipt.total))}
          </Typography>
        </Box>
        <IconButton size="small" onClick={() => setExpanded((v) => !v)} aria-label="Показать позиции">
          <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </IconButton>
      </Box>

      {tags.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
          {tags.map((t) => (
            <TagChip key={t.id} tag={t} />
          ))}
        </Box>
      )}

      <Collapse in={expanded}>
        <Stack spacing={1} sx={{ mt: 1.5, pt: 1.25, borderTop: `1px solid ${theme.palette.divider}` }}>
          {receipt.items.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" noWrap>
                  {item.name}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                  {item.quantity !== null && (
                    <Chip size="small" label={`×${item.quantity}`} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  )}
                  {item.price !== null && (
                    <Chip size="small" label={formatCurrency(item.price)} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                  )}
                </Box>
              </Box>
              <Typography
                className="tnum"
                variant="body2"
                sx={{ fontWeight: 600, color: item.expense ? colors.red : colors.green }}
              >
                {item.expense ? '−' : '+'}
                {formatCurrency(item.expense ?? item.income)}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Collapse>
    </Card>
  )
}
