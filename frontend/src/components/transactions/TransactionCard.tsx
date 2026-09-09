import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Box, ButtonBase, Card, Collapse, Typography, useTheme } from '@mui/material'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatLongDate } from '../../lib/format'
import { colors } from '../../theme'
import type { Tag, TransactionView } from '../../api/types'
import {
  SWIPE_ACTION_WIDTH,
  clampSwipeOffset,
  detectSwipeAxis,
  settleSwipe,
  swipeEditAction,
} from '../../lib/transactionInteractions.mjs'

interface TransactionCardProps {
  tx: TransactionView
  tagsMap: Map<string, Tag>
  swipeOpen: boolean
  animationIndex: number
  highlighted: boolean
  onSwipeOpen: (id: string | null) => void
  onEdit: (tx: TransactionView) => void
}

/**
 * Mobile transaction card — expandable details + swipe-left reveal of Edit.
 */
export function TransactionCard({
  tx,
  tagsMap,
  swipeOpen,
  animationIndex,
  highlighted,
  onSwipeOpen,
  onEdit,
}: TransactionCardProps) {
  const theme = useTheme()
  const [expanded, setExpanded] = useState(false)
  const [offset, setOffset] = useState(0)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const startOffset = useRef(0)
  const gestureAxis = useRef<'horizontal' | 'vertical' | null>(null)
  const dragging = useRef(false)
  const lastTouchEditRef = useRef(0)
  const lastHorizontalSwipeRef = useRef(0)

  const tag = tx.tagId ? tagsMap.get(tx.tagId) : undefined
  const isExpense = tx.expense !== null && tx.expense !== undefined
  const amount = isExpense ? tx.expense : tx.income
  const amountColor = isExpense ? colors.red : colors.green
  const revealProgress = Math.min(1, Math.abs(offset) / SWIPE_ACTION_WIDTH)

  useEffect(() => {
    if (!swipeOpen && !dragging.current) setOffset(0)
  }, [swipeOpen])

  const onTouchStart = (e: React.TouchEvent) => {
    if (!swipeOpen) onSwipeOpen(null)
    startX.current = e.touches[0]?.clientX ?? null
    startY.current = e.touches[0]?.clientY ?? null
    startOffset.current = swipeOpen ? -SWIPE_ACTION_WIDTH : offset
    gestureAxis.current = null
    dragging.current = true
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || startX.current === null || startY.current === null) return
    const dx = (e.touches[0]?.clientX ?? startX.current) - startX.current
    const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current
    if (gestureAxis.current === null && Math.max(Math.abs(dx), Math.abs(dy)) >= 7) {
      gestureAxis.current = detectSwipeAxis(dx, dy)
    }
    if (gestureAxis.current !== 'horizontal') return
    setOffset(clampSwipeOffset(startOffset.current, dx))
  }
  const endSwipe = () => {
    if (!dragging.current) return
    const wasHorizontal = gestureAxis.current === 'horizontal'
    if (wasHorizontal) lastHorizontalSwipeRef.current = Date.now()
    dragging.current = false
    startX.current = null
    startY.current = null
    gestureAxis.current = null
    const shouldOpen = settleSwipe(wasHorizontal ? 'horizontal' : gestureAxis.current, offset, swipeOpen)
    setOffset(shouldOpen ? -SWIPE_ACTION_WIDTH : 0)
    onSwipeOpen(shouldOpen ? tx.id : null)
  }

  const openEditor = () => {
    const action = swipeEditAction()
    setOffset(0)
    onSwipeOpen(action.openSwipeId)
    if (action.shouldEdit) onEdit(tx)
  }

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'F2') {
      event.preventDefault()
      openEditor()
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setExpanded((value) => !value)
    }
  }

  return (
    <Box
      className={`mobile-transaction-card${animationIndex < 6 ? ' mobile-transaction-card--enter' : ''}`}
      data-mobile-transaction-id={tx.id}
      style={{ '--mobile-card-delay': `${Math.min(animationIndex, 5) * 30}ms` } as CSSProperties}
      sx={{ position: 'relative', borderRadius: '8px', overflow: 'hidden' }}
      onTouchEnd={endSwipe}
      onTouchCancel={endSwipe}
    >
      <ButtonBase
        onClick={(event) => {
          event.stopPropagation()
          if (Date.now() - lastTouchEditRef.current < 700) return
          openEditor()
        }}
        onPointerUp={(event) => {
          if (event.pointerType === 'mouse') return
          event.preventDefault()
          event.stopPropagation()
          lastTouchEditRef.current = Date.now()
          openEditor()
        }}
        onTouchEnd={(event) => event.stopPropagation()}
        tabIndex={swipeOpen ? 0 : -1}
        aria-hidden={!swipeOpen}
        aria-label={`Изменить транзакцию «${tx.name}»`}
        sx={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: 0,
          width: SWIPE_ACTION_WIDTH,
          display: 'flex',
          flexDirection: 'column',
          gap: 0.5,
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'primary.main',
          color: '#fff',
          borderRadius: 0,
          '&:focus-visible': { outline: '3px solid', outlineColor: 'common.white', outlineOffset: -4 },
        }}
      >
        <Box
          className="mobile-swipe-action-content"
          sx={{
            display: 'grid',
            placeItems: 'center',
            gap: 0.5,
            opacity: 0.35 + revealProgress * 0.65,
            transform: `scale(${0.9 + revealProgress * 0.1})`,
          }}
        >
          <EditOutlinedIcon fontSize="small" />
          <Typography variant="caption" sx={{ color: 'inherit', fontWeight: 600 }}>
            Изменить
          </Typography>
        </Box>
      </ButtonBase>

      <Card
        className={`mobile-transaction-surface${highlighted ? ' mobile-transaction-surface--saved' : ''}`}
        component="article"
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        aria-label={`${tx.store ?? 'Без магазина'}, ${tx.name}. Enter — подробности, F2 — изменить`}
        sx={{
          p: 1.75,
          transform: `translate3d(${offset}px, 0, 0)`,
          transition: dragging.current ? 'none' : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: dragging.current ? 'transform' : 'auto',
          touchAction: 'pan-y',
          cursor: 'pointer',
          '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: -3 },
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onClick={() => {
          if (Date.now() - lastHorizontalSwipeRef.current < 500) return
          setExpanded((value) => !value)
        }}
        onKeyDown={handleCardKeyDown}
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
            className="mobile-expand-icon"
            sx={{
              gridColumn: 2,
              gridRow: tag ? 3 : 2,
              justifySelf: 'end',
              alignSelf: tag ? 'end' : 'center',
              fontSize: 18,
              color: colors.textSecondary,
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />

          {tag && (
            <Box sx={{ gridColumn: 1, gridRow: 3, display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              <TagChip tag={tag} />
            </Box>
          )}
        </Box>

        <Collapse
          in={expanded}
          timeout={{ enter: 260, exit: 180 }}
          easing={{ enter: 'cubic-bezier(0.16, 1, 0.3, 1)', exit: 'cubic-bezier(0.4, 0, 1, 1)' }}
        >
          <Box
            className="mobile-card-details"
            sx={{
              mt: 1.5,
              pt: 1.25,
              borderTop: `1px solid ${theme.palette.divider}`,
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 1,
              opacity: expanded ? 1 : 0,
              transform: expanded ? 'translateY(0)' : 'translateY(-4px)',
              transition: 'opacity 180ms ease, transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
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
