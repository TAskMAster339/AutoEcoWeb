import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid2 as Grid,
    ListItemIcon,
    Menu,
    MenuItem,
    Stack,
    TextField,
    Typography,
    useTheme,
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import CheckIcon from '@mui/icons-material/Check'
import TodayOutlinedIcon from '@mui/icons-material/TodayOutlined'
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined'
import { useUiStore, type PeriodKey } from '../../store/uiStore'
import { rangeFor } from '../../lib/period'
import { daysAgoIso, formatLongDate, formatPeriodLabel, todayIso } from '../../lib/format'

const PRESETS: Array<{ key: PeriodKey; label: string }> = [
    { key: 'thisMonth', label: 'Этот месяц' },
    { key: 'lastMonth', label: 'Прошлый месяц' },
    { key: '3m', label: 'Последние 3 месяца' },
    { key: 'all', label: 'Всё время' },
]

const MONTHS = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

const MIN_YEAR = 2000
const MAX_YEAR = 2100

function monthLabel(monthYear: string): string {
    const match = /^(\d{4})-(\d{2})$/.exec(monthYear)
    if (!match) return monthYear
    return `${MONTHS[Number(match[2]) - 1]} ${match[1]}`
}

export function PeriodSelector() {
    const theme = useTheme()
    const periodKey = useUiStore((s) => s.periodKey)
    const setPeriodKey = useUiStore((s) => s.setPeriodKey)
    const customFrom = useUiStore((s) => s.customFrom)
    const customTo = useUiStore((s) => s.customTo)
    const setCustomRange = useUiStore((s) => s.setCustomRange)
    const monthYear = useUiStore((s) => s.monthYear)
    const setMonthPeriod = useUiStore((s) => s.setMonthPeriod)
    const dayDate = useUiStore((s) => s.dayDate)
    const setDayPeriod = useUiStore((s) => s.setDayPeriod)

    const [anchor, setAnchor] = useState<null | HTMLElement>(null)
    const [customOpen, setCustomOpen] = useState(false)
    const [monthOpen, setMonthOpen] = useState(false)
    const [dayOpen, setDayOpen] = useState(false)
    const [draftFrom, setDraftFrom] = useState(customFrom ?? daysAgoIso(30))
    const [draftTo, setDraftTo] = useState(customTo ?? todayIso())
    const [draftDay, setDraftDay] = useState(dayDate ?? todayIso())
    const [draftYear, setDraftYear] = useState(String(new Date().getFullYear()))
    const [draftMonth, setDraftMonth] = useState<number | null>(null)

    const range = rangeFor(periodKey, customFrom, customTo, monthYear, dayDate)
    const label = periodKey === 'all'
        ? 'Всё время'
        : periodKey === 'month' && monthYear
            ? monthLabel(monthYear)
            : periodKey === 'day' && dayDate
                ? formatLongDate(dayDate)
                : formatPeriodLabel(range.from, range.to)

    const yearValid = draftYear.length === 4 && Number(draftYear) >= MIN_YEAR && Number(draftYear) <= MAX_YEAR
    const yearError = draftYear.length === 4 && !yearValid

    const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>, apply: () => void, canApply: boolean, close: () => void) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
            return
        }
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        event.preventDefault()
        event.stopPropagation()
        if (canApply) apply()
    }

    const selectPreset = (key: PeriodKey) => {
        setPeriodKey(key)
        setAnchor(null)
    }

    const openMonthDialog = () => {
        if (periodKey === 'month' && monthYear) {
            setDraftYear(monthYear.slice(0, 4))
            setDraftMonth(Number(monthYear.slice(5, 7)))
        } else {
            setDraftYear(String(new Date().getFullYear()))
            setDraftMonth(null)
        }
        setAnchor(null)
        setMonthOpen(true)
    }

    const openDayDialog = () => {
        setDraftDay(dayDate ?? todayIso())
        setAnchor(null)
        setDayOpen(true)
    }

    const openCustomDialog = () => {
        setDraftFrom(customFrom ?? daysAgoIso(30))
        setDraftTo(customTo ?? todayIso())
        setAnchor(null)
        setCustomOpen(true)
    }

    const menuItemSx = {
        minHeight: 42,
        mx: 0.5,
        px: 1.25,
        borderRadius: '6px',
        fontSize: 14,
        '&.Mui-selected': {
            bgcolor: 'action.selected',
            color: 'primary.main',
            fontWeight: 700,
        },
    } as const

    return (
        <>
            <Button
                variant="outlined"
                color="inherit"
                startIcon={<CalendarMonthIcon sx={{ fontSize: 18, color: 'primary.main' }} />}
                endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 17 }} />}
                onClick={(event) => setAnchor(event.currentTarget)}
                sx={{
                    height: 38,
                    minWidth: 0,
                    maxWidth: { xs: 172, sm: 'none' },
                    px: { xs: 1, sm: 1.5 },
                    color: 'text.primary',
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    whiteSpace: 'nowrap',
                    '& .MuiButton-startIcon': { mr: { xs: 0.75, sm: 1 } },
                    '& .MuiButton-endIcon': { ml: 0.5 },
                }}
                aria-label={`Выбрать период. Сейчас: ${label}`}
                aria-expanded={Boolean(anchor)}
            >
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', fontSize: { xs: 12.5, sm: 14 } }}>
                    {label}
                </Box>
            </Button>

            <Menu
                anchorEl={anchor}
                open={Boolean(anchor)}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        sx: {
                            mt: 0.75,
                            width: 250,
                            maxWidth: 'calc(100vw - 24px)',
                            p: 0.5,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: '8px',
                            boxShadow: theme.shadows[8],
                        },
                    },
                    list: { 'aria-label': 'Варианты периода', sx: { p: 0 } },
                }}
            >
                {PRESETS.map((preset) => (
                    <MenuItem key={preset.key} selected={periodKey === preset.key} onClick={() => selectPreset(preset.key)} sx={menuItemSx}>
                        <ListItemIcon sx={{ minWidth: 28 }}>
                            {periodKey === preset.key && <CheckIcon color="primary" sx={{ fontSize: 18 }} />}
                        </ListItemIcon>
                        {preset.label}
                    </MenuItem>
                ))}
                <Divider sx={{ my: 0.5 }} />
                <MenuItem selected={periodKey === 'month'} onClick={openMonthDialog} sx={menuItemSx}>
                    <ListItemIcon sx={{ minWidth: 28 }}><CalendarMonthIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                    Конкретный месяц
                </MenuItem>
                <MenuItem selected={periodKey === 'day'} onClick={openDayDialog} sx={menuItemSx}>
                    <ListItemIcon sx={{ minWidth: 28 }}><TodayOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                    Конкретный день
                </MenuItem>
                <MenuItem selected={periodKey === 'custom'} onClick={openCustomDialog} sx={menuItemSx}>
                    <ListItemIcon sx={{ minWidth: 28 }}><DateRangeOutlinedIcon sx={{ fontSize: 18 }} /></ListItemIcon>
                    Свой период
                </MenuItem>
            </Menu>

            <Dialog open={dayOpen} onClose={() => setDayOpen(false)} onKeyDown={(event) => handleDialogKeyDown(event, () => { setDayPeriod(draftDay); setDayOpen(false) }, Boolean(draftDay), () => setDayOpen(false))} maxWidth="xs" fullWidth>
                <DialogTitle>Конкретный день</DialogTitle>
                <DialogContent sx={{ pt: '12px !important' }}>
                    <Stack spacing={1.5}>
                        <Typography variant="body2" color="text.secondary">Покажем операции только за выбранную дату.</Typography>
                        <TextField label="Дата" type="date" value={draftDay} onChange={(event) => setDraftDay(event.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setDayOpen(false)}>Отмена</Button>
                    <Button variant="contained" disabled={!draftDay} onClick={() => { setDayPeriod(draftDay); setDayOpen(false) }}>Применить</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={customOpen} onClose={() => setCustomOpen(false)} onKeyDown={(event) => handleDialogKeyDown(event, () => { setCustomRange(draftFrom, draftTo); setCustomOpen(false) }, Boolean(draftFrom && draftTo && draftFrom <= draftTo), () => setCustomOpen(false))} maxWidth="xs" fullWidth>
                <DialogTitle>Свой период</DialogTitle>
                <DialogContent sx={{ pt: '12px !important' }}>
                    <Stack spacing={2}>
                        <TextField label="С" type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                        <TextField label="По" type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
                        <Typography variant="caption" color="text.secondary">{formatPeriodLabel(draftFrom, draftTo)}</Typography>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCustomOpen(false)}>Отмена</Button>
                    <Button variant="contained" onClick={() => { if (draftFrom && draftTo) setCustomRange(draftFrom, draftTo); setCustomOpen(false) }} disabled={!draftFrom || !draftTo || draftFrom > draftTo}>Применить</Button>
                </DialogActions>
            </Dialog>

            <Dialog open={monthOpen} onClose={() => setMonthOpen(false)} onKeyDown={(event) => handleDialogKeyDown(event, () => { if (draftMonth !== null) setMonthPeriod(`${draftYear}-${String(draftMonth).padStart(2, '0')}`); setMonthOpen(false) }, draftMonth !== null && yearValid, () => setMonthOpen(false))} maxWidth="xs" fullWidth>
                <DialogTitle>Конкретный месяц</DialogTitle>
                <DialogContent sx={{ pt: '12px !important' }}>
                    <Stack spacing={2}>
                        <TextField label="Год" value={draftYear} onChange={(event) => setDraftYear(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" fullWidth error={yearError} helperText={yearError ? `Введите год от ${MIN_YEAR} до ${MAX_YEAR}` : ' '} slotProps={{ inputLabel: { shrink: true } }} />
                        <Box>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>Месяц</Typography>
                            <Grid container spacing={1}>
                                {MONTHS.map((name, index) => {
                                    const month = index + 1
                                    const selected = draftMonth === month
                                    return (
                                        <Grid size={{ xs: 4 }} key={name}>
                                            <Button fullWidth variant={selected ? 'contained' : 'outlined'} color={selected ? 'primary' : 'inherit'} onClick={() => setDraftMonth(selected ? null : month)} sx={{ px: 0.5, py: 0.9, fontSize: 12.5, lineHeight: 1.2, borderColor: 'divider', color: selected ? undefined : 'text.primary' }}>{name}</Button>
                                        </Grid>
                                    )
                                })}
                            </Grid>
                        </Box>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setMonthOpen(false)}>Отмена</Button>
                    <Button variant="contained" disabled={draftMonth === null || !yearValid} onClick={() => { if (draftMonth !== null && yearValid) setMonthPeriod(`${draftYear}-${String(draftMonth).padStart(2, '0')}`); setMonthOpen(false) }}>Применить</Button>
                </DialogActions>
            </Dialog>
        </>
    )
}
