import { Chip, Box, useTheme } from '@mui/material'
import { lighten } from '@mui/material/styles'
import { colors } from '../../theme'
import type { Tag } from '../../api/types'

interface TagChipProps {
  tag: Tag
  onClick?: () => void
  selected?: boolean
  size?: 'small' | 'compact' | 'medium'
}

/** Colored pill for a tag (Продукты, Био, Молочка…), theme-aware:
 *  light — translucent tag color on white; dark — stronger tint + light text. */
export function TagChip({ tag, onClick, selected, size = 'medium' }: TagChipProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const compact = size === 'compact'

  const bg = isDark
    ? `${tag.color}${selected ? '40' : '26'}`
    : `${tag.color}${selected ? '33' : '1A'}`
  const text = isDark
    ? selected
      ? lighten(tag.color, 0.35)
      : theme.palette.text.primary
    : selected
      ? tag.color
      : colors.textPrimary

  return (
    <Chip
      label={
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
          {tag.icon ? (
            <Box
              component="span"
              aria-label={`Иконка тега ${tag.name}`}
              sx={{ fontSize: compact ? 13 : 15, lineHeight: 1, flexShrink: 0 }}
            >
              {tag.icon}
            </Box>
          ) : (
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: tag.color,
                flexShrink: 0,
              }}
            />
          )}
          <span>{tag.name}</span>
        </Box>
      }
      onClick={onClick}
      size={compact ? 'small' : size}
      sx={{
        bgcolor: bg,
        color: text,
        border: selected ? `1px solid ${tag.color}` : isDark ? `1px solid ${tag.color}40` : 'none',
        '&:hover': { bgcolor: `${tag.color}33` },
        cursor: onClick ? 'pointer' : 'default',
        ...(compact && {
          height: 24,
          fontSize: 12,
          borderRadius: '7px',
          '& .MuiChip-label': { px: 1 },
        }),
      }}
    />
  )
}
