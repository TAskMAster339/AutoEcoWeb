import { useCallback, useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    Autocomplete,
    Box,
    Button,
    Chip,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined'
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined'
import { BottomSheet } from '../common/BottomSheet'
import { NumericField } from '../common/NumericField'
import { TagChip } from '../common/TagChip'
import { useUiStore, type OperationFilter } from '../../store/uiStore'
import { normalizeAmountFilter } from '../../lib/numbers'
import type { Store, Tag } from '../../api/types'
import { fetchTransactionsPage } from '../../api/transactions'

interface FilterSheetProps {
    tags: Tag[] | undefined
    stores: Store[]
}

function storeLabel(store: Store): string {
    return store.alias_name || store.normalized_seller_name || store.seller_name
}

/** Выбор фильтров: поиск вынесен в тулбар, здесь остаются только рекомендации магазинов и тегов. */
export function FilterSheet({ tags, stores }: FilterSheetProps) {
    const open = useUiStore((state) => state.filterSheetOpen)
    const close = useUiStore((state) => state.closeFilterSheet)
    const tagFilterIds = useUiStore((state) => state.tagFilterIds)
    const untaggedOnly = useUiStore((state) => state.untaggedOnly)
    const storeFilters = useUiStore((state) => state.storeFilters)
    const amountMin = useUiStore((state) => state.amountMin)
    const amountMax = useUiStore((state) => state.amountMax)
    const operationFilter = useUiStore((state) => state.operationFilter)
    const applyFilters = useUiStore((state) => state.applyFilters)
    const resetFilters = useUiStore((state) => state.resetFilters)

    const [localTagFilterIds, setLocalTagFilterIds] = useState<string[]>(tagFilterIds)
    const [localUntaggedOnly, setLocalUntaggedOnly] = useState(untaggedOnly)
    const [localStoreFilters, setLocalStoreFilters] = useState<string[]>(storeFilters)
    const [localAmountMin, setLocalAmountMin] = useState(amountMin)
    const [localAmountMax, setLocalAmountMax] = useState(amountMax)
    const [localOperationFilter, setLocalOperationFilter] = useState<OperationFilter>(operationFilter)
    const [storeInput, setStoreInput] = useState('')
    const [tagInput, setTagInput] = useState('')
    const { data: untaggedPage } = useQuery({
        queryKey: ['transactions', 'untagged-total'],
        queryFn: () => fetchTransactionsPage({ limit: 1, untagged: true }),
        staleTime: 30_000,
    })

    const uniqueStores = useMemo(() => {
        const byDisplayName = new Map<string, Store>()
        for (const store of stores) {
            const displayName = storeLabel(store)
            const current = byDisplayName.get(displayName)
            if (!current || (store.alias_name && !current.alias_name)) byDisplayName.set(displayName, store)
        }
        return [...byDisplayName.values()]
    }, [stores])

    const selectedStores = useMemo(
        () => uniqueStores.filter((store) => localStoreFilters.includes(store.filter_value)),
        [localStoreFilters, uniqueStores],
    )
    const selectedTags = useMemo(
        () => (tags ?? []).filter((tag) => localTagFilterIds.includes(tag.id)),
        [localTagFilterIds, tags],
    )
    const suggestedStores = useMemo(
        () => uniqueStores.filter((store) => !localStoreFilters.includes(store.filter_value)),
        [localStoreFilters, uniqueStores],
    )
    const suggestedTags = useMemo(
        () => (tags ?? []).filter((tag) => !localTagFilterIds.includes(tag.id)),
        [localTagFilterIds, tags],
    )
    const matchingStores = useMemo(() => {
        const needle = storeInput.trim().toLocaleLowerCase('ru-RU')
        return needle ? suggestedStores.filter((store) => storeLabel(store).toLocaleLowerCase('ru-RU').includes(needle)) : suggestedStores
    }, [storeInput, suggestedStores])
    const matchingTags = useMemo(() => {
        const needle = tagInput.trim().toLocaleLowerCase('ru-RU')
        return needle ? suggestedTags.filter((tag) => tag.name.toLocaleLowerCase('ru-RU').includes(needle)) : suggestedTags
    }, [suggestedTags, tagInput])

    useEffect(() => {
        if (!open) return
        setLocalTagFilterIds(tagFilterIds)
        setLocalUntaggedOnly(untaggedOnly)
        setLocalStoreFilters(storeFilters)
        setLocalAmountMin(amountMin)
        setLocalAmountMax(amountMax)
        setLocalOperationFilter(operationFilter)
        setStoreInput('')
        setTagInput('')
    }, [amountMax, amountMin, open, operationFilter, storeFilters, tagFilterIds, untaggedOnly])

    const normalizedMin = normalizeAmountFilter(localAmountMin)
    const normalizedMax = normalizeAmountFilter(localAmountMax)
    const minInvalid = normalizedMin === null
    const maxInvalid = normalizedMax === null
    const amountRangeInvalid = (
        !minInvalid
        && !maxInvalid
        && normalizedMin !== ''
        && normalizedMax !== ''
        && Number(normalizedMin) > Number(normalizedMax)
    )
    const amountFilterInvalid = minInvalid || maxInvalid || amountRangeInvalid

    const toggleStore = useCallback((store: Store) => {
        setLocalStoreFilters((current) =>
            current.includes(store.filter_value)
                ? current.filter((value) => value !== store.filter_value)
                : [...current, store.filter_value],
        )
    }, [])
    const toggleTag = useCallback((tag: Tag) => {
        setLocalUntaggedOnly(false)
        setLocalTagFilterIds((current) =>
            current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id],
        )
    }, [])

    const apply = useCallback(() => {
        if (amountFilterInvalid || normalizedMin === null || normalizedMax === null) return
        applyFilters({
            search: useUiStore.getState().search,
            tagFilterIds: localTagFilterIds,
            untaggedOnly: localUntaggedOnly,
            storeFilters: localStoreFilters,
            amountMin: normalizedMin,
            amountMax: normalizedMax,
            operationFilter: localOperationFilter,
            periodKey: useUiStore.getState().periodKey,
        })
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        close()
    }, [amountFilterInvalid, applyFilters, close, localOperationFilter, localStoreFilters, localTagFilterIds, localUntaggedOnly, normalizedMax, normalizedMin])

    const reset = useCallback(() => {
        setLocalTagFilterIds([])
        setLocalUntaggedOnly(false)
        setLocalStoreFilters([])
        setLocalAmountMin('')
        setLocalAmountMax('')
        setLocalOperationFilter('all')
        resetFilters()
        close()
    }, [close, resetFilters])

    const handleAutocompleteKeyDown = useCallback((event: KeyboardEvent<HTMLElement>, selectFirst: () => void) => {
        if (event.key !== 'Enter') return
        event.preventDefault()
        event.stopPropagation()
        if (event.shiftKey) {
            apply()
            return
        }
        selectFirst()
    }, [apply])

    const handleSheetKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            reset()
        }
    }

    return (
        <BottomSheet open={open} onClose={close} title="Фильтры" maxWidth={640}>
            <Stack spacing={{ xs: 2, sm: 2.5 }} onKeyDown={handleSheetKeyDown}>
                <Typography variant="body2" color="text.secondary">
                    Поиск по операциям находится в строке над таблицей. Ограничьте сумму операции или выберите магазин и теги.
                </Typography>

                <ToggleButtonGroup
                    value={localOperationFilter}
                    exclusive
                    onChange={(_, value: OperationFilter | null) => value && setLocalOperationFilter(value)}
                    size="small"
                    fullWidth
                    aria-label="Тип транзакций"
                >
                    <ToggleButton value="all" sx={{ flex: 1 }}>Все</ToggleButton>
                    <ToggleButton value="expense" sx={{ flex: 1 }}>Расходы</ToggleButton>
                    <ToggleButton value="income" sx={{ flex: 1 }}>Доходы</ToggleButton>
                </ToggleButtonGroup>

                <Box>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                        <PaymentsOutlinedIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle2">Сумма операции</Typography>
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
                        <NumericField
                            label="От, ₽"
                            value={localAmountMin}
                            onChange={setLocalAmountMin}
                            min={0}
                            placeholder="100"
                            error={minInvalid || amountRangeInvalid}
                            helperText={minInvalid ? 'Введите неотрицательное число' : amountRangeInvalid ? 'Минимум больше максимума' : 'Включительно'}
                        />
                        <NumericField
                            label="До, ₽"
                            value={localAmountMax}
                            onChange={setLocalAmountMax}
                            min={0}
                            placeholder="1000"
                            error={maxInvalid || amountRangeInvalid}
                            helperText={maxInvalid ? 'Введите неотрицательное число' : amountRangeInvalid ? 'Максимум меньше минимума' : 'Включительно'}
                        />
                    </Stack>
                </Box>

                <Box>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                        <StorefrontOutlinedIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle2">Магазины</Typography>
                    </Stack>
                    <Autocomplete
                        options={matchingStores}
                        value={null}
                        inputValue={storeInput}
                        onInputChange={(_, value) => setStoreInput(value)}
                        onChange={(_, store) => {
                            if (store) toggleStore(store)
                            setStoreInput('')
                        }}
                        getOptionLabel={storeLabel}
                        isOptionEqualToValue={(option, value) => option.filter_value === value.filter_value}
                        openOnFocus
                        autoHighlight
                        selectOnFocus
                        clearOnEscape
                        noOptionsText="Магазин не найден"
                        renderOption={(props, store) => (
                            <Box component="li" {...props} key={store.filter_value} sx={{ minHeight: 44, display: 'flex', alignItems: 'center' }}>
                                <Typography noWrap>{storeLabel(store)}</Typography>
                                {store.alias_name && <Chip label="алиас" size="small" color="primary" sx={{ ml: 'auto' }} />}
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Найти магазин"
                                placeholder="Начните вводить название"
                                onKeyDownCapture={(event) => handleAutocompleteKeyDown(event, () => {
                                    const store = matchingStores[0]
                                    if (store) {
                                        toggleStore(store)
                                        setStoreInput('')
                                    }
                                })}
                            />
                        )}
                    />
                    {selectedStores.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                            {selectedStores.map((store) => (
                                <Chip key={store.filter_value} label={storeLabel(store)} color="primary" clickable onClick={() => toggleStore(store)} />
                            ))}
                        </Box>
                    )}
                </Box>

                <Box>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1 }}>
                        <LocalOfferOutlinedIcon color="primary" fontSize="small" />
                        <Typography variant="subtitle2">Теги</Typography>
                    </Stack>
                    <Button
                        variant={localUntaggedOnly ? 'contained' : 'outlined'}
                        size="small"
                        onClick={() => {
                            setLocalUntaggedOnly((current) => !current)
                            setLocalTagFilterIds([])
                            setTagInput('')
                        }}
                        aria-pressed={localUntaggedOnly}
                        sx={{ mb: 1.25 }}
                    >
                        Без тега · {untaggedPage?.total ?? '—'}
                    </Button>
                    <Autocomplete
                        disabled={localUntaggedOnly}
                        options={matchingTags}
                        value={null}
                        inputValue={tagInput}
                        onInputChange={(_, value) => setTagInput(value)}
                        onChange={(_, tag) => {
                            if (tag) toggleTag(tag)
                            setTagInput('')
                        }}
                        getOptionLabel={(tag) => tag.name}
                        isOptionEqualToValue={(option, value) => option.id === value.id}
                        openOnFocus
                        autoHighlight
                        selectOnFocus
                        clearOnEscape
                        noOptionsText="Тег не найден"
                        renderOption={(props, tag) => (
                            <Box component="li" {...props} key={tag.id} sx={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: tag.color, border: '1px solid', borderColor: 'divider', flexShrink: 0 }} />
                                {tag.icon && <Typography component="span" sx={{ lineHeight: 1 }}>{tag.icon}</Typography>}
                                <Typography noWrap>{tag.name}</Typography>
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={localUntaggedOnly ? 'Выключите фильтр «Без тега»' : 'Найти тег'}
                                placeholder={localUntaggedOnly ? undefined : 'Начните вводить название'}
                                onKeyDownCapture={(event) => handleAutocompleteKeyDown(event, () => {
                                    const tag = matchingTags[0]
                                    if (tag) {
                                        toggleTag(tag)
                                        setTagInput('')
                                    }
                                })}
                            />
                        )}
                    />
                    {selectedTags.length > 0 && (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                            {selectedTags.map((tag) => (
                                <TagChip key={tag.id} tag={tag} selected onClick={() => toggleTag(tag)} />
                            ))}
                        </Box>
                    )}
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ pt: 0.5 }}>
                    <Button variant="outlined" onClick={reset} fullWidth>Сбросить</Button>
                    <Button variant="contained" onClick={apply} disabled={amountFilterInvalid} fullWidth>Применить</Button>
                </Stack>
            </Stack>
        </BottomSheet>
    )
}
