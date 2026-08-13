import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { BottomSheet } from '../common/BottomSheet'
import { useUiStore } from '../../store/uiStore'
import type { Store, Tag } from '../../api/types'


interface FilterSheetProps {
  tags: Tag[] | undefined
  stores: Store[]
}

export function FilterSheet({ tags, stores }: FilterSheetProps) {
  const open = useUiStore((s) => s.filterSheetOpen)
  const close = useUiStore((s) => s.closeFilterSheet)
  const search = useUiStore((s) => s.search)
  const tagFilterIds = useUiStore((s) => s.tagFilterIds)
  const storeFilters = useUiStore((s) => s.storeFilters)
  const applyFilters = useUiStore((s) => s.applyFilters)
  const resetFilters = useUiStore((s) => s.resetFilters)

  const [localSearch, setLocalSearch] = useState(search)
  const [localTagFilterIds, setLocalTagFilterIds] = useState<string[]>(tagFilterIds)
  const [localStoreFilters, setLocalStoreFilters] = useState<string[]>(storeFilters)

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

  /** Переключатель значения в списке мультивыбора: добавить/убрать. */
  const toggleInList = (list: string[], value: string): string[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  useEffect(() => {
    if (!open) return
    setLocalSearch(search)
    setLocalTagFilterIds(tagFilterIds)
    setLocalStoreFilters(storeFilters)
  }, [open, search, tagFilterIds, storeFilters])

  const apply = () => {
    applyFilters({
      search: localSearch,
      tagFilterIds: localTagFilterIds,
      storeFilters: localStoreFilters,
      periodKey: useUiStore.getState().periodKey,
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
                  color={localStoreFilters.includes(filterValue) ? 'primary' : 'default'}
                  variant={localStoreFilters.includes(filterValue) ? 'filled' : 'outlined'}
                  onClick={() =>
                    setLocalStoreFilters((prev) => toggleInList(prev, filterValue))
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
                color={localTagFilterIds.includes(t.id) ? 'primary' : 'default'}
                variant={localTagFilterIds.includes(t.id) ? 'filled' : 'outlined'}
                onClick={() => setLocalTagFilterIds((prev) => toggleInList(prev, t.id))}
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
