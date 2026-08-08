import { useRef, useState } from 'react'
import { Box, Card, Collapse, IconButton, Typography, useTheme } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatLongDate } from '../../lib/format'
import { colors } from '../../theme'
import type { Tag, TransactionView } from '../../api/types'

interface TransactionCardProps {
  tx: TransactionView
  tagsMap: Map<string, Tag>
  onDelete: (id: string) => void
}

/**
 * Mobile transaction card — expandable details + swipe-left reveal of Delete.
 */
export function TransactionCard({ tx, tagsMap, onDelete }: TransactionCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [offset, setOffset] = useState(0)
  const startX = useRef<number | null>(null)
  const dragging = useRef(false)

  const tag = tx.tagId ? tagsMap.get(tx.tagId) : undefined
  const isExpense = tx.expense !== null && tx.expense !== undefined
  const amount = isExpense ? tx.expense : tx.income
  const amountColor = isExpense ? colors.red : colors.green

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0]?.clientX ?? null
    dragging.current = true
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || startX.current === null) return
    const dx = (e.touches[0]?.clientX ?? startX.current) - startX.current
    setOffset(Math.max(-88, Math.min(0, dx)))
  }
  const endSwipe = () => {
    dragging.current = false
    startX.current = null
    setOffset(offset < -44 ? -88 : 0)
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }} onTouchEnd={endSwipe}>
      {/* Delete action revealed by swipe */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 88,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: colors.red,
          color: '#fff',
        }}
      >
        <IconButton
          onClick={() => onDelete(tx.id)}
          aria-label="Удалить"
          sx={{ color: '#fff' }}
        >
          <DeleteOutlineIcon />
        </IconButton>
      </Box>

      <Card
        sx={{
          p: 1.75,
          transform: `translateX(${offset}px)`,
          transition: dragging.current ? 'none' : 'transform 0.2s ease',
          cursor: 'pointer',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onClick={() => setExpanded((v) => !v)}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{tx.store ?? '—'}</Typography>
              <Typography variant="caption" color="text.secondary">
                {formatLongDate(tx.date)}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
              {tx.description}
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
              {tag && <TagChip key={tag.id} tag={tag} />}
            </Box>
          </Box>
          <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
            <Typography
              className="tnum"
              sx={{ fontWeight: 700, fontSize: 15, color: amountColor }}
            >
              {isExpense ? '−' : '+'}
              {formatCurrency(amount)}
            </Typography>
          </Box>
          <ExpandMoreIcon
            sx={{
              fontSize: 18,
              color: colors.textSecondary,
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
              mt: 0.5,
            }}
          />
        </Box>

        <Collapse in={expanded}>
          <Box
            sx={{
              mt: 1.5,
              pt: 1.25,
              borderTop: `1px solid ${theme.palette.divider}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
            }}
          >
            <Detail label="Кол-во" value={tx.quantity !== null && tx.quantity !== undefined ? String(tx.quantity) : '—'} />
            <Detail label="Цена" value={formatCurrency(tx.price)} />
            <Detail label="Баланс" value={formatCurrency(tx.balance)} />
          </Box>
        </Collapse>
      </Card>
    </Box>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
        {value}
      </Typography>
    </Box>
  )
}
