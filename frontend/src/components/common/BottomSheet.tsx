import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Box, IconButton, SwipeableDrawer, Typography, useMediaQuery, useTheme } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { getKeyboardViewport } from '../../lib/visualViewport.mjs'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  maxWidth?: number
  maxHeight?: string | number
  height?: string | number
}

interface KeyboardViewportState {
  keyboardOpen: boolean
  bottomInset: number
  maxHeight: number | null
}

const CLOSED_VIEWPORT: KeyboardViewportState = {
  keyboardOpen: false,
  bottomInset: 0,
  maxHeight: null,
}

function useKeyboardViewport(open: boolean, enabled: boolean): KeyboardViewportState {
  const [state, setState] = useState(CLOSED_VIEWPORT)
  const baselineHeightRef = useRef(0)

  useEffect(() => {
    if (!open || !enabled || !window.visualViewport) {
      setState(CLOSED_VIEWPORT)
      return
    }

    const viewport = window.visualViewport
    baselineHeightRef.current = Math.max(window.innerHeight, viewport.height + viewport.offsetTop)
    let animationFrame: number | null = null

    const measure = () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const next = getKeyboardViewport(
          window.innerHeight,
          viewport.height,
          viewport.offsetTop,
          baselineHeightRef.current,
        )
        if (!next.keyboardOpen) {
          baselineHeightRef.current = Math.max(window.innerHeight, viewport.height + viewport.offsetTop)
        }
        setState(next)
      })
    }

    const resetBaseline = () => {
      baselineHeightRef.current = Math.max(window.innerHeight, viewport.height + viewport.offsetTop)
      measure()
    }

    measure()
    viewport.addEventListener('resize', measure)
    viewport.addEventListener('scroll', measure)
    window.addEventListener('resize', measure)
    window.addEventListener('orientationchange', resetBaseline)
    return () => {
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
      viewport.removeEventListener('resize', measure)
      viewport.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      window.removeEventListener('orientationchange', resetBaseline)
    }
  }, [enabled, open])

  return state
}

/** Mobile-first bottom sheet (rounded top, drag-free, Esc/backdrop closes). */
export function BottomSheet({ open, onClose, title, children, maxWidth = 640, maxHeight, height }: BottomSheetProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const keyboardViewport = useKeyboardViewport(open, isMobile)

  useEffect(() => {
    if (!open || !keyboardViewport.keyboardOpen) return
    const activeElement = document.activeElement
    if (!(activeElement instanceof HTMLElement)) return
    const animationFrame = window.requestAnimationFrame(() => {
      activeElement.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [keyboardViewport.keyboardOpen, keyboardViewport.maxHeight, open, reduceMotion])

  const keyboardMaxHeight = keyboardViewport.keyboardOpen && keyboardViewport.maxHeight !== null
    ? `${keyboardViewport.maxHeight}px`
    : undefined

  return (
    <SwipeableDrawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      onOpen={() => undefined}
      disableSwipeToOpen
      hysteresis={0.25}
      minFlingVelocity={450}
      // All panels use an explicit trigger, so keep the closed modal out of
      // the DOM and avoid mounting every form on mobile. Swipe-to-close still
      // works while the panel is open.
      ModalProps={{ keepMounted: false }}
      // Не возвращаем фокус на кнопку-триггер после закрытия: иначе MUI
      // оставляет на ней focus-visible подсветку после Enter/клика.
      disableRestoreFocus
      slotProps={{
        transition: {
          appear: true,
          timeout: { enter: 320, exit: 210 },
          easing: {
            enter: 'cubic-bezier(0.16, 1, 0.3, 1)',
            exit: 'cubic-bezier(0.4, 0, 1, 1)',
          },
        },
        backdrop: {
          sx: {
            transition: 'opacity 220ms ease !important',
          },
        },
        paper: {
          sx: {
            maxWidth,
            width: '100%',
            mx: 'auto',
            borderTopLeftRadius: 12,
            borderTopRightRadius: 12,
            px: { xs: 1.5, sm: 3 },
            pt: 1.25,
            pb: keyboardViewport.keyboardOpen ? 2.5 : 'calc(20px + env(safe-area-inset-bottom))',
            bottom: keyboardViewport.bottomInset,
            maxHeight: keyboardMaxHeight ?? maxHeight ?? { xs: 'calc(100dvh - 8px)', sm: '92dvh' },
            height,
            overflowY: 'auto',
            scrollPaddingBlock: '72px',
            overscrollBehavior: 'contain',
            transitionProperty: 'transform, bottom, max-height',
            '@media (prefers-reduced-motion: reduce)': {
              transitionDuration: '140ms !important',
            },
          },
        },
      }}
      aria-label={title}
    >
      <Box sx={{ position: 'sticky', top: -10, zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, py: 0.75, bgcolor: 'background.paper' }}>
        <Typography variant="h6">{title}</Typography>
        <IconButton onClick={onClose} aria-label="Закрыть" size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      {children}
    </SwipeableDrawer>
  )
}
