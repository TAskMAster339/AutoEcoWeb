import { useEffect, useRef, useState } from 'react'
import { Box, ButtonBase, Card, Collapse, Typography, useTheme } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatLongDate } from '../../lib/format'
import { colors } from '../../theme'
import type { Tag, TransactionView } from '../../api/types'

interface TransactionCardProps {
  tx: TransactionView
  tagsMap: Map<string, Tag>
  swipeOpen: boolean
  onSwipeOpen: (id: string | null) => void
  onEdit: (tx: TransactionView) => void
}

/**
 * Mobile transaction card — expandable details + swipe-left reveal of Edit.
 */
export function TransactionCard({ tx, tagsMap, swipeOpen, onSwipeOpen, onEdit }: TransactionCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [offset, setOffset] = useState(0)
  const startX = useRef<number | null>(null)
  const dragging = useRef(false)

  const tag = tx.tagId ? tagsMap.get(tx.tagId) : undefined
  const isExpense = tx.expense !== null && tx.expense !== undefined
  const amount = isExpense ? tx.expense : tx.income
  const amountColor = isExpense ? colors.red : colors.green

  useEffect(() => {
    if (!swipeOpen && !dragging.current) setOffset(0)
  }, [swipeOpen])

  const onTouchStart = (e: React.TouchEvent) => {
    if (!swipeOpen) onSwipeOpen(null)
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
    const shouldOpen = offset < -44
    setOffset(shouldOpen ? -88 : 0)
    onSwipeOpen(shouldOpen ? tx.id : null)
  }

  return (
    <Box sx={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }} onTouchEnd={endSwipe}>
      <ButtonBase
        onClick={(event) => {
          event.stopPropagation()
          setOffset(0)
          onSwipeOpen(null)
          onEdit(tx)
        }}
        aria-label={`Изменить транзакцию «${tx.name}»`}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: 88,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'primary.main',
          color: '#fff',
          borderRadius: 0,
        }}
      >
        <EditOutlinedIcon fontSize="small" />
        <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
          Изменить
        </Typography>
      </ButtonBase>

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
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            columnGap: 1.5,
            rowGap: 0.25,
          }}
        >
          <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography noWrap sx={{ minWidth: 0, fontWeight: 700, fontSize: 14.5 }}>
                {tx.store ?? '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                {formatLongDate(tx.date)}
              </Typography>
          </Box>
          <Typography
            className="tnum"
            sx={{ justifySelf: 'end', fontWeight: 700, fontSize: 15, color: amountColor }}
          >
            {isExpense ? '−' : '+'}
            {formatCurrency(amount)}
          </Typography>

          <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
            {tx.name}
          </Typography>
          <ExpandMoreIcon
            sx={{
              gridColumn: 2,
              gridRow: tag ? 3 : 2,
              justifySelf: 'end',
              alignSelf: tag ? 'end' : 'center',
              fontSize: 18,
              color: colors.textSecondary,
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />

          {tag && (
            <Box sx={{ gridColumn: 1, gridRow: 3, display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              <TagChip tag={tag} />
            </Box>
          )}
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
          {tx.comment && (
            <Box sx={{ mt: 1.25, pt: 1.25, borderTop: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                Комментарий
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {tx.comment}
              </Typography>
            </Box>
          )}
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
