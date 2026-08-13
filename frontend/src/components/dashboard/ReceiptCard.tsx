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
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useNavigate } from 'react-router-dom'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatLongDate } from '../../lib/format'
import { colors } from '../../theme'
import type { Receipt } from '../../lib/receipts'
import type { Tag } from '../../api/types'

interface ReceiptCardProps {
    receipt: Receipt
    tagsMap: Map<string, Tag>
}

/** Чек — крупный квадратный тайл (grid-раскладка на /receipt).
 *  Клик по тайлу открывает подробную страницу чека (/receipts/:id). */
export function ReceiptCard({ receipt, tagsMap }: ReceiptCardProps) {
    const theme = useTheme()
    const navigate = useNavigate()
    const [expanded, setExpanded] = useState(false)
    const tags = receipt.tagIds.map((id) => tagsMap.get(id)).filter((t): t is Tag => Boolean(t))

    const accent = receipt.isIncome ? colors.green : colors.primary

    const open = () => navigate(`/receipts/${receipt.id}`)

    return (
        <Card
            component="article"
            onClick={open}
            role="link"
            tabIndex={0}
            aria-label={`Чек ${receipt.store} на ${formatCurrency(Math.abs(receipt.total))}`}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open()
                }
            }}
            sx={{
                aspectRatio: { xs: 'auto', sm: '1 / 1' },
                minHeight: { xs: 188, sm: 0 },
                p: { xs: 1.75, sm: 2 },
                display: 'flex',
                flexDirection: 'column',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 3 },
                '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
            }}
        >
            {/* Заголовок тайла: инициал магазина + сумма */}
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <Box
                    sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 19,
                        fontWeight: 800,
                        color: '#fff',
                        bgcolor: accent,
                        flexShrink: 0,
                    }}
                    aria-hidden
                >
                    {receipt.store.charAt(0).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                    <Typography
                        className="tnum"
                        sx={{ fontWeight: 800, fontSize: 17, letterSpacing: '-0.02em', color: receipt.isIncome ? colors.green : colors.red }}
                    >
                        {receipt.isIncome ? '+' : '−'}
                        {formatCurrency(Math.abs(receipt.total))}
                    </Typography>
                </Box>
            </Box>

            {/* Магазин + дата */}
            <Box sx={{ mt: 'auto', minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 700, fontSize: 15 }} title={receipt.store}>
                    {receipt.store}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {formatLongDate(receipt.date)} · {receipt.items.length} поз.
                </Typography>
            </Box>

            {/* Теги */}
            {tags.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap', overflow: 'hidden', maxHeight: 52 }}>
                    {tags.slice(0, 3).map((t) => (
                        <TagChip key={t.id} tag={t} />
                    ))}
                </Box>
            )}

            {/* Развернуть позиции / открыть страницу */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 0.5 }}>
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation()
                        setExpanded((v) => !v)
                    }}
                    aria-label="Показать позиции"
                    aria-expanded={expanded}
                >
                    <ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', fontSize: 20 }} />
                </IconButton>
                <IconButton size="small" onClick={(e) => { e.stopPropagation(); open() }} aria-label="Открыть подробности чека">
                    <OpenInNewIcon sx={{ fontSize: 18 }} />
                </IconButton>
            </Box>

            {/* Позиции чека поверх тайла */}
            <Collapse in={expanded} sx={{ mt: -1 }}>
                <Stack spacing={1} sx={{ mt: 0.5, pt: 1, borderTop: `1px solid ${theme.palette.divider}`, maxHeight: 180, overflowY: 'auto' }}>
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
