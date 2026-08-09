import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
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
import type { Store, Tag } from '../../api/types'

const PERIODS: Array<{ key: PeriodKey; label: string }> = [
  { key: 'thisMonth', label: 'Месяц' },
  { key: '3m', label: '3 мес' },
  { key: 'all', label: 'Всё' },
]

interface FilterSheetProps {
  tags: Tag[] | undefined
  stores: Store[]
}

export function FilterSheet({ tags, stores }: FilterSheetProps) {
  const open = useUiStore((s) => s.filterSheetOpen)
  const close = useUiStore((s) => s.closeFilterSheet)
  const search = useUiStore((s) => s.search)
  const tagFilterId = useUiStore((s) => s.tagFilterId)
  const storeFilter = useUiStore((s) => s.storeFilter)
  const periodKey = useUiStore((s) => s.periodKey)
  const applyFilters = useUiStore((s) => s.applyFilters)
  const resetFilters = useUiStore((s) => s.resetFilters)

  const [localSearch, setLocalSearch] = useState(search)
  const [localTagFilterId, setLocalTagFilterId] = useState(tagFilterId)
  const [localStoreFilter, setLocalStoreFilter] = useState(storeFilter)
  const [localPeriodKey, setLocalPeriodKey] = useState(periodKey)
  const uniqueStores = useMemo(() => {
    const byDisplayName = new Map<string, Store>()
    for (const store of stores) {
      const displayName = store.alias_name || store.normalized_seller_name || store.seller_name
      const current = byDisplayName.get(displayName)
      if (!current || (store.alias_name && !current.alias_name)) {
        byDisplayName.set(displayName, store)
      }
    }
    return [...byDisplayName.values()]
  }, [stores])

  useEffect(() => {
    if (!open) return
    setLocalSearch(search)
    setLocalTagFilterId(tagFilterId)
    setLocalStoreFilter(storeFilter)
    setLocalPeriodKey(periodKey)
  }, [open, search, tagFilterId, storeFilter, periodKey])

  const apply = () => {
    applyFilters({
      search: localSearch,
      tagFilterId: localTagFilterId,
      storeFilter: localStoreFilter,
      periodKey: localPeriodKey,
    })
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    close()
  }

  const reset = () => {
    setLocalSearch('')
    resetFilters()
    close()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Enter') apply()
    else reset()
  }

  return (
    <BottomSheet open={open} onClose={close} title="Фильтры">
      <Stack spacing={2.25} onKeyDown={handleKeyDown}>
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
          <ToggleButtonGroup value={localPeriodKey} exclusive onChange={(_, v) => v && setLocalPeriodKey(v)} size="small" fullWidth>
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
            {uniqueStores.map((store) => {
              const filterValue = store.filter_value
              const displayName = store.alias_name || store.normalized_seller_name || store.seller_name

              return (
                <Chip
                  key={filterValue}
                  label={displayName}
                  clickable
                  color={localStoreFilter === filterValue ? 'primary' : 'default'}
                  variant={localStoreFilter === filterValue ? 'filled' : 'outlined'}
                  onClick={() =>
                    setLocalStoreFilter(localStoreFilter === filterValue ? null : filterValue)
                  }
                />
              )
            })}
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
                color={localTagFilterId === t.id ? 'primary' : 'default'}
                variant={localTagFilterId === t.id ? 'filled' : 'outlined'}
                onClick={() => setLocalTagFilterId(localTagFilterId === t.id ? null : t.id)}
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
