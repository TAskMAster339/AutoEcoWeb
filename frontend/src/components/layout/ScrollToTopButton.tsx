import { useEffect, useState } from 'react'
import { IconButton, Zoom, useMediaQuery, useTheme } from '@mui/material'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'

interface ScrollToTopButtonProps {
  scrollContainer: HTMLElement | null
  hidden?: boolean
}

/** Мобильная кнопка быстрого возврата к началу страницы. */
export function ScrollToTopButton({ scrollContainer, hidden = false }: ScrollToTopButtonProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isMobile || hidden || !scrollContainer) {
      setVisible(false)
      return
    }

    let frame = 0
    const updateVisibility = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const threshold = Math.max(560, scrollContainer.clientHeight * 0.8)
        const hasLongPage = scrollContainer.scrollHeight > scrollContainer.clientHeight + 120
        setVisible(hasLongPage && scrollContainer.scrollTop > threshold)
      })
    }

    updateVisibility()
    scrollContainer.addEventListener('scroll', updateVisibility, { passive: true })
    window.addEventListener('resize', updateVisibility)
    return () => {
      cancelAnimationFrame(frame)
      scrollContainer.removeEventListener('scroll', updateVisibility)
      window.removeEventListener('resize', updateVisibility)
    }
  }, [hidden, isMobile, scrollContainer])

  const scrollToTop = () => {
    scrollContainer?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <Zoom in={visible} mountOnEnter unmountOnExit>
      <IconButton
        onClick={scrollToTop}
        aria-label="Вернуться в начало страницы"
        sx={{
          position: 'fixed',
          right: 20,
          bottom: 'calc(86px + env(safe-area-inset-bottom))',
          zIndex: 1190,
          width: 44,
          height: 44,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '9px',
          bgcolor: 'background.paper',
          color: 'primary.main',
          boxShadow:
            theme.palette.mode === 'dark'
              ? '0 8px 24px rgba(0,0,0,0.48)'
              : '0 8px 24px rgba(16,24,40,0.18)',
          WebkitTapHighlightColor: 'transparent',
          '&:hover': { bgcolor: 'background.paper' },
          '&:active': { transform: 'translateY(1px)' },
        }}
      >
        <KeyboardArrowUpIcon sx={{ fontSize: 27 }} />
      </IconButton>
    </Zoom>
  )
}
