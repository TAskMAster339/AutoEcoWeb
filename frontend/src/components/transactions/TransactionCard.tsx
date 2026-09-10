import { memo, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { Box, Button, ButtonBase, Card, Checkbox, Typography, useTheme } from '@mui/material'
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
  expanded: boolean
  animationIndex: number
  highlighted: boolean
  selected: boolean
  selectionMode: boolean
  onSwipeOpen: (id: string | null) => void
  onExpandedChange: (id: string | null) => void
  onEdit: (tx: TransactionView) => void
  onTagEdit: (tx: TransactionView) => void
  onSelectionStart: (id: string) => void
  onSelectionToggle: (id: string) => void
}

/**
 * Mobile transaction card — expandable details + swipe-left reveal of Edit.
 */
export const TransactionCard = memo(function TransactionCard({
  tx,
  tagsMap,
  swipeOpen,
  expanded,
  animationIndex,
  highlighted,
  selected,
  selectionMode,
  onSwipeOpen,
  onExpandedChange,
  onEdit,
  onTagEdit,
  onSelectionStart,
  onSelectionToggle,
}: TransactionCardProps) {
  const theme = useTheme()
  const [offset, setOffset] = useState(0)
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const startOffset = useRef(0)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const gestureAxis = useRef<'horizontal' | 'vertical' | null>(null)
  const dragging = useRef(false)
  const lastTouchEditRef = useRef(0)
  const lastHorizontalSwipeRef = useRef(0)
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const longPressTriggeredRef = useRef(false)

  const tag = tx.tagId ? tagsMap.get(tx.tagId) : undefined
  const isExpense = tx.expense !== null && tx.expense !== undefined
  const amount = isExpense ? tx.expense : tx.income
  const amountColor = isExpense ? colors.red : colors.green
  const revealProgress = Math.min(1, Math.abs(offset) / SWIPE_ACTION_WIDTH)

  useEffect(() => {
    if (!swipeOpen && !dragging.current) setOffset(0)
  }, [swipeOpen])

  useEffect(() => {
    if (!selectionMode) return
    dragging.current = false
    startX.current = null
    startY.current = null
    gestureAxis.current = null
    cancelLongPress()
    setOffset(0)
  }, [selectionMode])

  useEffect(() => () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
  }, [])

  const cancelLongPress = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
    longPressTimerRef.current = null
  }

  const beginLongPress = () => {
    cancelLongPress()
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null
      longPressTriggeredRef.current = true
      dragging.current = false
      setOffset(0)
      onSwipeOpen(null)
      onSelectionStart(tx.id)
    }, 450)
  }

  const onTouchStart = (e: React.TouchEvent) => {
    longPressTriggeredRef.current = false
    if (selectionMode) {
      dragging.current = false
      return
    }
    if (!swipeOpen) onSwipeOpen(null)
    startX.current = e.touches[0]?.clientX ?? null
    startY.current = e.touches[0]?.clientY ?? null
    startOffset.current = swipeOpen ? -SWIPE_ACTION_WIDTH : offset
    gestureAxis.current = null
    dragging.current = true
    beginLongPress()
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || startX.current === null || startY.current === null) return
    const dx = (e.touches[0]?.clientX ?? startX.current) - startX.current
    const dy = (e.touches[0]?.clientY ?? startY.current) - startY.current
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 7) cancelLongPress()
    if (gestureAxis.current === null && Math.max(Math.abs(dx), Math.abs(dy)) >= 7) {
      gestureAxis.current = detectSwipeAxis(dx, dy)
    }
    if (gestureAxis.current !== 'horizontal') return
    setOffset(clampSwipeOffset(startOffset.current, dx))
  }
  const endSwipe = () => {
    cancelLongPress()
    if (longPressTriggeredRef.current || selectionMode) {
      dragging.current = false
      return
    }
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
    if (selectionMode) return
    if (event.key === 'F2') {
      event.preventDefault()
      openEditor()
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
      onContextMenu={(event) => {
        event.preventDefault()
        if (!selectionMode) {
          longPressTriggeredRef.current = true
          onSelectionStart(tx.id)
        }
      }}
      onPointerDown={(event) => {
        if (selectionMode || event.button !== 0) return
        longPressTriggeredRef.current = false
        pointerStart.current = { x: event.clientX, y: event.clientY }
        beginLongPress()
      }}
      onPointerMove={(event) => {
        if (!pointerStart.current) return
        const dx = event.clientX - pointerStart.current.x
        const dy = event.clientY - pointerStart.current.y
        if (Math.max(Math.abs(dx), Math.abs(dy)) >= 7) cancelLongPress()
      }}
      onPointerUp={() => {
        pointerStart.current = null
        cancelLongPress()
      }}
      onPointerCancel={() => {
        pointerStart.current = null
        cancelLongPress()
      }}
    >
      {!selectionMode && (
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
      )}

      <Card
        className={`mobile-transaction-surface${highlighted ? ' mobile-transaction-surface--saved' : ''}`}
        component="article"
        sx={{
          position: 'relative',
          p: 1.75,
          transform: `translate3d(${selectionMode ? 0 : offset}px, 0, 0)`,
          transition: dragging.current ? 'none' : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          willChange: dragging.current ? 'transform' : 'auto',
          touchAction: 'pan-y',
          WebkitTapHighlightColor: 'transparent',
          ...(selected ? {
            boxShadow: `inset 0 0 0 2px ${theme.palette.primary.main}`,
          } : {}),
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      >
        <ButtonBase
          aria-expanded={selectionMode ? undefined : expanded}
          aria-pressed={selectionMode ? selected : undefined}
          aria-label={selectionMode
            ? `${selected ? 'Снять выделение' : 'Выбрать'}: ${tx.store ?? 'Без магазина'}, ${tx.name}`
            : `${tx.store ?? 'Без магазина'}, ${tx.name}. Enter — подробности, F2 — изменить`}
          onClick={() => {
            if (longPressTriggeredRef.current) {
              longPressTriggeredRef.current = false
              return
            }
            if (selectionMode) {
              onSelectionToggle(tx.id)
              return
            }
            if (Date.now() - lastHorizontalSwipeRef.current < 500) return
            onExpandedChange(expanded ? null : tx.id)
          }}
          onKeyDown={handleCardKeyDown}
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            borderRadius: 'inherit',
            WebkitTapHighlightColor: 'transparent',
            '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: -3 },
          }}
        />

        <Box sx={{ position: 'relative', zIndex: 2, pointerEvents: 'none' }}>
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            columnGap: 1.5,
            rowGap: 0.25,
          }}>
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

            <Typography variant="body2" color="text.secondary" noWrap sx={{ minWidth: 0, gridColumn: '1 / -1', pr: 4 }}>
              {tx.name}
            </Typography>

            {tag && (
              <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 0.5, mt: 0.5, pr: 4, flexWrap: 'wrap' }}>
                <TagChip tag={tag} />
              </Box>
            )}
          </Box>

          {expanded && (
            <Box
              className="mobile-card-expanded-content"
              sx={{
                mt: 1.5,
                pt: 1.25,
                pr: 4,
                borderTop: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1 }}>
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
            </Box>
          )}
        </Box>

        {!tag && (
          <Button
            size="small"
            variant="text"
            onClick={() => {
              if (longPressTriggeredRef.current) {
                longPressTriggeredRef.current = false
                return
              }
              if (selectionMode) onSelectionToggle(tx.id)
              else onTagEdit(tx)
            }}
            sx={{ position: 'relative', zIndex: 3, mt: 1, ml: -1, minHeight: 44 }}
          >
            Назначить тег
          </Button>
        )}
        <ExpandMoreIcon
          className="mobile-expand-icon"
          sx={{
            position: 'absolute',
            zIndex: 2,
            right: 12,
            bottom: 12,
            pointerEvents: 'none',
            fontSize: 18,
            color: colors.textSecondary,
            display: selectionMode ? 'none' : undefined,
            transform: expanded ? 'rotate(180deg)' : 'none',
            transition: 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
        {selectionMode && (
          <Checkbox
            checked={selected}
            tabIndex={-1}
            disableRipple
            inputProps={{ 'aria-hidden': true }}
            sx={{
              position: 'absolute',
              zIndex: 2,
              right: 8,
              bottom: 8,
              width: 40,
              height: 40,
              pointerEvents: 'none',
              color: 'text.secondary',
              '&.Mui-checked': { color: 'primary.main' },
            }}
          />
        )}
      </Card>
    </Box>
  )
})

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
