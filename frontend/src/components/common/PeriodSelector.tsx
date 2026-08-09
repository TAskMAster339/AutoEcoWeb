import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2 as Grid,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { useUiStore, type PeriodKey } from '../../store/uiStore'
import { rangeFor } from '../../lib/period'
import { daysAgoIso, formatPeriodLabel, todayIso } from '../../lib/format'

const PRESETS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'thisMonth', label: 'Этот месяц' },
  { key: 'lastMonth', label: 'Прошлый месяц' },
  { key: '3m', label: 'Последние 3 месяца' },
  { key: 'all', label: 'Всё время' },
]

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
]

/** Минимальный/максимальный год, который принимает выбор конкретного месяца. */
const MIN_YEAR = 2000
const MAX_YEAR = 2100

/** «2026-08» → «Август 2026» (по MONTHS, без Date — не зависит от таймзоны). */
function monthLabel(monthYear: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(monthYear)
  if (!m) return monthYear
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

/** Период: dropdown with presets + custom date range dialog + конкретный месяц. */
export function PeriodSelector() {
  const periodKey = useUiStore((s) => s.periodKey)
  const setPeriodKey = useUiStore((s) => s.setPeriodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const setCustomRange = useUiStore((s) => s.setCustomRange)
  const monthYear = useUiStore((s) => s.monthYear)
  const setMonthPeriod = useUiStore((s) => s.setMonthPeriod)

  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(customFrom ?? daysAgoIso(30))
  const [draftTo, setDraftTo] = useState(customTo ?? todayIso())
  const [draftYear, setDraftYear] = useState(String(new Date().getFullYear()))
  const [draftMonth, setDraftMonth] = useState<number | null>(null)

  const range = rangeFor(periodKey, customFrom, customTo, monthYear)
  const label =
    periodKey === 'all'
      ? 'Всё время'
      : periodKey === 'month' && monthYear
        ? monthLabel(monthYear)
        : formatPeriodLabel(range.from, range.to)

  const yearValid = draftYear.length === 4 && Number(draftYear) >= MIN_YEAR && Number(draftYear) <= MAX_YEAR
  const yearError = draftYear.length === 4 && !yearValid

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

  const applyMonth = () => {
    if (draftMonth !== null && yearValid) {
      setMonthPeriod(`${draftYear}-${String(draftMonth).padStart(2, '0')}`)
      setMonthOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<CalendarMonthIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
        endIcon={<KeyboardArrowDownIcon sx={{ fontSize: 16 }} />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper', whiteSpace: 'nowrap' }}
        aria-label="Выбрать период"
      >
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
          Период:{' '}
        </Box>
        {label}
      </Button>

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {PRESETS.map((p) => (
          <MenuItem
            key={p.key}
            selected={periodKey === p.key}
            onClick={() => {
              setPeriodKey(p.key)
              setAnchor(null)
            }}
          >
            {p.label}
          </MenuItem>
        ))}
        <MenuItem
          selected={periodKey === 'month'}
          onClick={openMonthDialog}
        >
          Конкретный месяц…
        </MenuItem>
        <MenuItem
          selected={periodKey === 'custom'}
          onClick={() => {
            setDraftFrom(customFrom ?? daysAgoIso(30))
            setDraftTo(customTo ?? todayIso())
            setAnchor(null)
            setCustomOpen(true)
          }}
        >
          Свой период…
        </MenuItem>
      </Menu>

      <Dialog open={customOpen} onClose={() => setCustomOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Свой период</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="С"
              type="date"
              value={draftFrom}
              onChange={(e) => setDraftFrom(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <TextField
              label="По"
              type="date"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Typography variant="caption" color="text.secondary">
              {formatPeriodLabel(draftFrom, draftTo)}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCustomOpen(false)}>Отмена</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (draftFrom && draftTo) setCustomRange(draftFrom, draftTo)
              setCustomOpen(false)
            }}
            disabled={!draftFrom || !draftTo || draftFrom > draftTo}
          >
            Применить
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={monthOpen} onClose={() => setMonthOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>Конкретный месяц</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField
              label="Год"
              value={draftYear}
              onChange={(e) => setDraftYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              fullWidth
              error={yearError}
              slotProps={{ inputLabel: { shrink: true } }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                Месяц
              </Typography>
              <Grid container spacing={1}>
                {MONTHS.map((name, i) => {
                  const m = i + 1
                  const selected = draftMonth === m
                  return (
                    <Grid size={{ xs: 4 }} key={name}>
                      <Button
                        fullWidth
                        variant={selected ? 'contained' : 'outlined'}
                        color={selected ? 'primary' : 'inherit'}
                        onClick={() => setDraftMonth(selected ? null : m)}
                        sx={{
                          textTransform: 'none',
                          px: 0.5,
                          py: 0.75,
                          fontSize: 13,
                          lineHeight: 1.2,
                          borderRadius: '8px',
                          borderColor: 'divider',
                          color: selected ? undefined : 'text.primary',
                        }}
                      >
                        {name}
                      </Button>
                    </Grid>
                  )
                })}
              </Grid>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setMonthOpen(false)}>Отмена</Button>
          <Button variant="contained" onClick={applyMonth} disabled={draftMonth === null || !yearValid}>
            Применить
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
