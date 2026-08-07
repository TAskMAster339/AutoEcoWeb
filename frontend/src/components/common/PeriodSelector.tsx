import { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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

/** Период: dropdown with presets + custom date range dialog. */
export function PeriodSelector() {
  const periodKey = useUiStore((s) => s.periodKey)
  const setPeriodKey = useUiStore((s) => s.setPeriodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const setCustomRange = useUiStore((s) => s.setCustomRange)

  const [anchor, setAnchor] = useState<null | HTMLElement>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [draftFrom, setDraftFrom] = useState(customFrom ?? daysAgoIso(30))
  const [draftTo, setDraftTo] = useState(customTo ?? todayIso())

  const range = rangeFor(periodKey, customFrom, customTo)
  const label = periodKey === 'all' ? 'Всё время' : formatPeriodLabel(range.from, range.to)

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
    </>
  )
}
