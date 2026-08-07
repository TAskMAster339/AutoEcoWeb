import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { BottomSheet } from '../common/BottomSheet'
import { useUiStore, type PeriodKey } from '../../store/uiStore'
import type { Tag } from '../../api/types'

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'thisMonth', label: 'Месяц' },
  { key: '3m', label: '3 мес' },
  { key: 'all', label: 'Всё' },
]

interface FilterSheetProps {
  tags: Tag[] | undefined
  stores: string[]
}

export function FilterSheet({ tags, stores }: FilterSheetProps) {
  const open = useUiStore((s) => s.filterSheetOpen)
  const close = useUiStore((s) => s.closeFilterSheet)
  const search = useUiStore((s) => s.search)
  const setSearch = useUiStore((s) => s.setSearch)
  const tagFilterId = useUiStore((s) => s.tagFilterId)
  const setTagFilter = useUiStore((s) => s.setTagFilter)
  const storeFilter = useUiStore((s) => s.storeFilter)
  const setStoreFilter = useUiStore((s) => s.setStoreFilter)
  const periodKey = useUiStore((s) => s.periodKey)
  const setPeriodKey = useUiStore((s) => s.setPeriodKey)
  const resetFilters = useUiStore((s) => s.resetFilters)

  const [localSearch, setLocalSearch] = useState(search)

  const apply = () => {
    setSearch(localSearch)
    close()
  }

  const reset = () => {
    setLocalSearch('')
    resetFilters()
    close()
  }

  return (
    <BottomSheet open={open} onClose={close} title="Фильтры">
      <Stack spacing={2.25}>
        <TextField
          label="Поиск"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          fullWidth
          placeholder="Магазин, описание…"
        />

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Период
          </Typography>
          <ToggleButtonGroup value={periodKey} exclusive onChange={(_, v) => v && setPeriodKey(v)} size="small" fullWidth>
            {PERIODS.map((p) => (
              <ToggleButton key={p.key} value={p.key} sx={{ flex: 1 }}>
                {p.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Магазин
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {stores.map((s) => (
              <Chip
                key={s}
                label={s}
                clickable
                color={storeFilter === s ? 'primary' : 'default'}
                variant={storeFilter === s ? 'filled' : 'outlined'}
                onClick={() => setStoreFilter(storeFilter === s ? null : s)}
              />
            ))}
          </Box>
        </Box>

        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            Теги
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
            {(tags ?? []).map((t) => (
              <Chip
                key={t.id}
                label={t.name}
                clickable
                color={tagFilterId === t.id ? 'primary' : 'default'}
                variant={tagFilterId === t.id ? 'filled' : 'outlined'}
                onClick={() => setTagFilter(tagFilterId === t.id ? null : t.id)}
              />
            ))}
          </Box>
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button variant="outlined" onClick={reset} fullWidth>
            Сбросить
          </Button>
          <Button variant="contained" onClick={apply} fullWidth>
            Применить
          </Button>
        </Stack>
      </Stack>
    </BottomSheet>
  )
}
