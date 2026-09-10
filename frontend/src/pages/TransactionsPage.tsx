import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Badge,
    Box,
    Button,
    CircularProgress,
    Grid2 as Grid,
    Skeleton,
    Stack,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AddIcon from '@mui/icons-material/Add'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { StatisticCard } from '../components/common/StatisticCard'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { TransactionCard } from '../components/transactions/TransactionCard'
import { VirtualizedTransactionList } from '../components/transactions/VirtualizedTransactionList'
import { FilterSheet } from '../components/transactions/FilterSheet'
import { EditTransactionDialog } from '../components/transactions/EditTransactionDialog'
import { QuickTagSheet } from '../components/transactions/QuickTagSheet'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useSummary } from '../hooks/useSummary'
import { useStores, useDeleteTransaction } from '../hooks/useTransactions'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { useUiStore } from '../store/uiStore'
import { useFilterParams } from '../lib/filters'
import { fetchTransactionsPage, toTransactionView } from '../api/transactions'
import { formatCurrency, pluralRu } from '../lib/format'
import { normalizeAmountFilter } from '../lib/numbers'
import { colors, softBg, softFg } from '../theme'
import { PageSearch } from '../components/common/PageSearch'
import type { Transaction, TransactionUpdatePatch, TransactionView } from '../api/types'
import { hasActiveTableFilters, nextOpenSwipeId, replaceTransactionInPlace } from '../lib/transactionInteractions.mjs'

/** Размер автоматически подгружаемой страницы мобильного списка. */
const MOBILE_PAGE = 50
const TransactionsGrid = lazy(() =>
    import('../components/transactions/TransactionsGrid').then((module) => ({ default: module.TransactionsGrid })),
)
const BulkEditSheet = lazy(() =>
    import('../components/transactions/BulkEditSheet').then((module) => ({ default: module.BulkEditSheet })),
)

function hasSeenSwipeHint(): boolean {
    try {
        return window.localStorage.getItem('autoeco:swipe-hint-seen') === '1'
    } catch {
        return false
    }
}

function rememberSwipeHint(): void {
    try {
        window.localStorage.setItem('autoeco:swipe-hint-seen', '1')
    } catch {
        // Storage may be unavailable in strict privacy modes; the hint still works.
    }
}

function SummaryCards() {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const { data, isLoading } = useSummary()

    if (isLoading) {
        return (
            <Grid container spacing={1.5}>
                {[0, 1, 2, 3].map((i) => (
                    <Grid size={{ xs: 6, md: 3 }} key={i}>
                        <Skeleton variant="rounded" height={108} sx={{ borderRadius: '8px' }} />
                    </Grid>
                ))}
            </Grid>
        )
    }

    if (!data) return null

    // Разность доходов и расходов: зелёная, если доходы больше расходов, иначе красная.
    const net = data.income - data.expenses

    return (
        <Grid container spacing={1.5}>
            <Grid size={{ xs: 6, md: 3 }}>
                <StatisticCard
                    label="Баланс"
                    value={formatCurrency(data.balance)}
                    delta={net}
                    // Спарклайн только на десктопе: на мобильном не помещается рядом с дельтой.
                    sparkline={isMobile ? undefined : data.balanceTrend}
                />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
                <StatisticCard label="Доходы" value={formatCurrency(data.income)} delta={data.incomeDelta} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
                <StatisticCard label="Расходы" value={formatCurrency(data.expenses)} delta={data.expensesDelta} />
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
                <StatisticCard label="Транзакций" value={String(data.transactions)} hint="За этот период" />
            </Grid>
        </Grid>
    )
}

/** Таблица — the main screen from the designer's mockup. */
export function TransactionsPage() {
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const online = useOnline()
    const queryClient = useQueryClient()

    const storeFilters = useUiStore((s) => s.storeFilters)
    const amountMin = useUiStore((s) => s.amountMin)
    const amountMax = useUiStore((s) => s.amountMax)
    const operationFilter = useUiStore((s) => s.operationFilter)
    const { data: txRevision } = useQuery({ queryKey: ['txRevision'], queryFn: () => 0 })

    // Параметры фильтров (период/тег/поиск/магазин) — применяет бэкенд.
    const params = useFilterParams()

    const { data: tags } = useTags()
    const { data: stores = [] } = useStores()
    const deleteTx = useDeleteTransaction()

    // Сколько транзакций у пользователя ВООБЩЕ (без фильтров) — для различения
    // «Пока нет операций» (пустая учётка) и «Ничего не найдено» (пустой период).
    // Заодно это «гейт» загрузки страницы: пока нет ответа — спиннер.
    const {
        data: allTimeTotal,
        isLoading: totalLoading,
        isError: totalError,
        refetch,
    } = useQuery({
        queryKey: ['txTotal'],
        queryFn: async () => {
            const page = await fetchTransactionsPage({ limit: 1 })
            return page.total ?? 0
        },
        staleTime: 30_000,
    })

    // Общее число строк с фильтрами — приходит из datasource таблицы
    // или из мобильного списка (для пустых состояний).
    const [total, setTotal] = useState<number | null>(null)

    // Мобильный список: догрузка страницами по кнопке «Показать ещё».
    const [mobileRows, setMobileRows] = useState<TransactionView[]>([])
    const [mobileLoading, setMobileLoading] = useState(true)
    const [mobileLoadingMore, setMobileLoadingMore] = useState(false)
    const [mobileLoadError, setMobileLoadError] = useState(false)
    const [mobileSwipeId, setMobileSwipeId] = useState<string | null>(null)
    const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null)
    const [showSwipeHint, setShowSwipeHint] = useState(() => !hasSeenSwipeHint())
    const [highlightedMobileId, setHighlightedMobileId] = useState<string | null>(null)
    const mobileSentinelRef = useRef<HTMLDivElement | null>(null)
    const highlightTimerRef = useRef<number | null>(null)
    const editOpenFrameRef = useRef<number | null>(null)
    const editOpenRef = useRef(false)
    const editingTxIdRef = useRef<string | null>(null)

    useEffect(() => () => {
        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
        if (editOpenFrameRef.current !== null) window.cancelAnimationFrame(editOpenFrameRef.current)
    }, [])

    useEffect(() => {
        if (!isMobile || !mobileSwipeId) return
        const scrollRoot = document.querySelector<HTMLElement>('main')
        const closeSwipe = () => setMobileSwipeId(null)
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target instanceof Element ? event.target : null
            const card = target?.closest<HTMLElement>('[data-mobile-transaction-id]')
            if (card?.dataset.mobileTransactionId !== mobileSwipeId) closeSwipe()
        }
        scrollRoot?.addEventListener('scroll', closeSwipe, { passive: true })
        document.addEventListener('pointerdown', closeOnOutsidePointer)
        return () => {
            scrollRoot?.removeEventListener('scroll', closeSwipe)
            document.removeEventListener('pointerdown', closeOnOutsidePointer)
        }
    }, [isMobile, mobileSwipeId])

    const handleSwipeOpen = useCallback((id: string | null) => {
        setMobileSwipeId(nextOpenSwipeId(id))
        if (id && showSwipeHint) {
            rememberSwipeHint()
            setShowSwipeHint(false)
        }
    }, [showSwipeHint])

    const handleTransactionSaved = useCallback((id: string) => {
        setHighlightedMobileId(id)
        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
        highlightTimerRef.current = window.setTimeout(() => {
            setHighlightedMobileId(null)
            highlightTimerRef.current = null
        }, 1600)
    }, [])

    // Смена фильтров/периода → сброс списка и первая страница.
    useEffect(() => {
        let cancelled = false
        setMobileLoading(true)
        setMobileLoadError(false)
        setMobileSwipeId(null)
        void queryClient
            .fetchQuery({
                queryKey: ['txPage', params, 'date', 'asc', MOBILE_PAGE, 0],
                // Мобильный список всегда по возрастанию даты: старые сверху
                // (бэкенд по умолчанию сортирует desc — сортировку шлём явно).
                queryFn: () => fetchTransactionsPage({ limit: MOBILE_PAGE, offset: 0, ...params, sort_by: 'date', sort_dir: 'asc' }),
                staleTime: 30_000,
            })
            .then((page) => {
                if (cancelled) return
                setMobileRows(page.items.map(toTransactionView))
                setTotal(page.total ?? 0)
            })
            .catch(() => undefined)
            .finally(() => {
                if (!cancelled) setMobileLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [params, queryClient, txRevision])

    const loadMoreMobile = useCallback(async () => {
        if (mobileLoadingMore || total === null || mobileRows.length >= total) return
        setMobileLoadingMore(true)
        setMobileLoadError(false)
        try {
            const page = await queryClient.fetchQuery({
                queryKey: ['txPage', params, 'date', 'asc', MOBILE_PAGE, mobileRows.length],
                queryFn: () => fetchTransactionsPage({ limit: MOBILE_PAGE, offset: mobileRows.length, ...params, sort_by: 'date', sort_dir: 'asc' }),
                staleTime: 30_000,
            })
            setMobileRows((prev) => [...prev, ...page.items.map(toTransactionView)])
            setTotal(page.total ?? 0)
        } catch {
            setMobileLoadError(true)
        } finally {
            setMobileLoadingMore(false)
        }
    }, [mobileLoadingMore, mobileRows.length, params, queryClient, total])

    useEffect(() => {
        if (!isMobile || mobileLoading || mobileLoadingMore || mobileLoadError) return
        if (total === null || mobileRows.length >= total) return
        const sentinel = mobileSentinelRef.current
        if (!sentinel) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry?.isIntersecting) void loadMoreMobile()
            },
            { root: document.querySelector('main'), rootMargin: '0px 0px 320px 0px' },
        )
        observer.observe(sentinel)
        return () => observer.disconnect()
    }, [isMobile, loadMoreMobile, mobileLoadError, mobileLoading, mobileLoadingMore, mobileRows.length, total])

    // Выбранные в таблице строки (чекбоксы) → панель «Удалить (N)».
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
    const [bulkEditOpen, setBulkEditOpen] = useState(false)
    const [selectionResetRevision, setSelectionResetRevision] = useState(0)
    const [bulkError, setBulkError] = useState<string | null>(null)
    // Данные остаются смонтированными во время закрытия, чтобы Drawer мог
    // доиграть exit-анимацию вместо мгновенного удаления из DOM.
    const [editingTx, setEditingTx] = useState<TransactionView | null>(null)
    const [editOpen, setEditOpen] = useState(false)
    const [tagEditingTx, setTagEditingTx] = useState<TransactionView | null>(null)
    const [tagEditOpen, setTagEditOpen] = useState(false)

    const openTransactionEditor = useCallback((tx: TransactionView) => {
        // Touch browsers can emit pointerup and a synthetic click for the same
        // tap. Do not restart the Drawer transition when it is already opening
        // or open for this transaction.
        if (editingTxIdRef.current === tx.id && (editOpenRef.current || editOpenFrameRef.current !== null)) return
        if (editOpenFrameRef.current !== null) window.cancelAnimationFrame(editOpenFrameRef.current)
        editingTxIdRef.current = tx.id
        setEditingTx(tx)
        if (editOpenRef.current) {
            editOpenRef.current = false
            setEditOpen(false)
        }
        // Один закрытый кадр гарантирует enter-анимацию даже при первом
        // открытии; это быстрее порога восприятия задержки.
        editOpenFrameRef.current = window.requestAnimationFrame(() => {
            editOpenFrameRef.current = null
            editOpenRef.current = true
            setEditOpen(true)
        })
    }, [])

    const closeTransactionEditor = useCallback(() => {
        if (editOpenFrameRef.current !== null) {
            window.cancelAnimationFrame(editOpenFrameRef.current)
            editOpenFrameRef.current = null
        }
        editOpenRef.current = false
        setEditOpen(false)
    }, [])

    const handleTransactionUpdated = useCallback((updated: Transaction, patch: TransactionUpdatePatch) => {
        if (!updated.id) return
        if (patch.datetime === undefined) {
            setMobileRows((rows) => {
                const updatedView = toTransactionView(updated)
                const preserveInheritedStore = !('seller_name' in patch) && updatedView.store === null
                return replaceTransactionInPlace(rows, updatedView, preserveInheritedStore)
            })
        }
        handleTransactionSaved(updated.id)
    }, [handleTransactionSaved])

    const openTagEditor = useCallback((tx: TransactionView) => {
        setTagEditingTx(tx)
        setTagEditOpen(true)
    }, [])

    const closeTagEditor = useCallback(() => {
        setTagEditOpen(false)
    }, [])

    const bulkDelete = async () => {
        setBulkError(null)
        try {
            await Promise.all(selectedIds.map((id) => deleteTx.mutateAsync(id)))
            setSelectedIds([])
            setSelectionResetRevision((revision) => revision + 1)
            setConfirmDeleteOpen(false)
        } catch (e) {
            setBulkError(e instanceof Error ? e.message : 'Не удалось удалить транзакции')
        }
    }

    const openFilterSheet = useUiStore((s) => s.openFilterSheet)
    const openAddMenu = useUiStore((s) => s.openAddMenu)
    const search = useUiStore((s) => s.search)
    const tagFilterIds = useUiStore((s) => s.tagFilterIds)
    const untaggedOnly = useUiStore((s) => s.untaggedOnly)
    const periodKey = useUiStore((s) => s.periodKey)
    const customFrom = useUiStore((s) => s.customFrom)
    const customTo = useUiStore((s) => s.customTo)
    const monthYear = useUiStore((s) => s.monthYear)
    const dayDate = useUiStore((s) => s.dayDate)
    const resetFilters = useUiStore((s) => s.resetFilters)

    const handleResetFilters = () => {
        resetFilters()
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`)
    }

    // Применённые фильтры можно сохранить/открыть ссылкой.
    const urlInitialized = useRef(false)
    useEffect(() => {
        if (urlInitialized.current) return
        const query = new URLSearchParams(window.location.search)
        const state = useUiStore.getState()
        const urlSearch = query.get('search')
        const urlTags = query.getAll('tag')
        const urlUntagged = query.get('untagged') === '1'
        const urlStores = query.getAll('store')
        const urlAmountMin = query.get('amountMin')
        const urlAmountMax = query.get('amountMax')
        const urlOperation = query.get('type')
        const urlPeriod = query.get('period')
        const urlFrom = query.get('from')
        const urlTo = query.get('to')
        const urlMonth = query.get('month')
        const urlDay = query.get('day')
        const nextAmountMin = urlAmountMin === null ? state.amountMin : (normalizeAmountFilter(urlAmountMin) ?? '')
        const nextAmountMax = urlAmountMax === null ? state.amountMax : (normalizeAmountFilter(urlAmountMax) ?? '')
        const normalizedMin = normalizeAmountFilter(nextAmountMin)
        const normalizedMax = normalizeAmountFilter(nextAmountMax)
        const invalidAmountRange = (
            normalizedMin !== null
            && normalizedMax !== null
            && normalizedMin !== ''
            && normalizedMax !== ''
            && Number(normalizedMin) > Number(normalizedMax)
        )
        state.applyFilters({
            search: urlSearch ?? state.search,
            tagFilterIds: urlTags.some(Boolean) ? urlTags.filter(Boolean) : state.tagFilterIds,
            untaggedOnly: urlUntagged || (urlTags.some(Boolean) ? false : state.untaggedOnly),
            storeFilters: urlStores.some(Boolean) ? urlStores.filter(Boolean) : state.storeFilters,
            amountMin: invalidAmountRange ? '' : (normalizedMin ?? ''),
            amountMax: invalidAmountRange ? '' : (normalizedMax ?? ''),
            operationFilter: urlOperation === 'income' || urlOperation === 'expense' ? urlOperation : state.operationFilter,
            periodKey: state.periodKey,
        })
        if (urlDay) state.setDayPeriod(urlDay)
        else if (urlFrom && urlTo) state.setCustomRange(urlFrom, urlTo)
        else if (urlMonth) state.setMonthPeriod(urlMonth)
        else if (urlPeriod) state.setPeriodKey(urlPeriod as Parameters<typeof state.setPeriodKey>[0])
        urlInitialized.current = true
    }, [])

    useEffect(() => {
        if (!urlInitialized.current) return
        const query = new URLSearchParams()
        if (search) query.set('search', search)
        if (tagFilterIds.length) tagFilterIds.forEach((id) => query.append('tag', id))
        else if (untaggedOnly) query.set('untagged', '1')
        if (storeFilters.length) storeFilters.forEach((store) => query.append('store', store))
        if (amountMin !== '') query.set('amountMin', amountMin)
        if (amountMax !== '') query.set('amountMax', amountMax)
        if (operationFilter !== 'all') query.set('type', operationFilter)
        if (periodKey !== 'all') query.set('period', periodKey)
        if (periodKey === 'custom' && customFrom && customTo) {
            query.set('from', customFrom)
            query.set('to', customTo)
        }
        if (periodKey === 'month' && monthYear) query.set('month', monthYear)
        if (periodKey === 'day' && dayDate) query.set('day', dayDate)
        const next = query.toString()
        const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
        if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
            window.history.replaceState(null, '', nextUrl)
        }
    }, [search, tagFilterIds, untaggedOnly, storeFilters, amountMin, amountMax, operationFilter, periodKey, customFrom, customTo, monthYear, dayDate])

    const tagsMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
    // Период — отдельный глобальный срез в шапке, а не фильтр из панели.
    // Поэтому он не включает точку на кнопке и не активирует «Сбросить фильтры».
    const hasTableFilters = hasActiveTableFilters({ search, tagFilterIds, untaggedOnly, storeFilters, amountMin, amountMax, operationFilter })

    const showNoTransactions = total === 0 && (allTimeTotal ?? 0) === 0 && !hasTableFilters
    const showNotFound = total === 0 && !showNoTransactions

    if (totalLoading) return <LoadingState label="Загружаем операции…" />
    if (!online) return <OfflineState onRetry={() => void refetch()} />
    if (totalError) return <ErrorState message="Не удалось загрузить операции" onRetry={() => void refetch()} />

    return (
        <Stack spacing={{ xs: 1.5, md: 2.25 }} sx={{ height: { md: '100%' }, minHeight: 0 }}>
            <SummaryCards />

            {/* Toolbar: filters table-only; period lives in the shared header. */}
            <Box sx={{ display: 'grid', width: '100%', alignItems: 'center', gap: 1, gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(200px, 1fr) auto auto auto' } }}>
                <Box sx={{ minWidth: 0, gridColumn: { xs: '1 / -1', sm: 'auto' } }}>
                    <PageSearch value={search} onChange={useUiStore.getState().setSearch} placeholder="Магазин, название или комментарий" ariaLabel="Поиск по магазинам, названиям и комментариям" width="100%" />
                </Box>
                <Button
                    variant={hasTableFilters ? 'outlined' : 'text'}
                    color={hasTableFilters ? 'primary' : 'inherit'}
                    startIcon={hasTableFilters ? <RestartAltIcon /> : undefined}
                    onClick={handleResetFilters}
                    disabled={!hasTableFilters}
                    aria-label="Сбросить активные фильтры"
                    sx={(theme) => ({
                        textTransform: 'none',
                        ...(hasTableFilters
                            ? {
                                bgcolor: softBg(theme),
                                color: softFg(theme),
                                borderColor: 'primary.main',
                                fontWeight: 700,
                                boxShadow: 1,
                                '&:hover': { bgcolor: 'primary.light', borderColor: 'primary.dark', boxShadow: 2 },
                            }
                            : { color: 'text.secondary' }),
                    })}
                >
                    <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Сбросить фильтры</Box>
                    <Box component="span" sx={{ display: { xs: 'inline', sm: 'none' } }}>Сбросить</Box>
                </Button>
                {hasTableFilters ? (
                    <Badge className="active-filter-badge" color="primary" variant="dot">
                        <Button
                            variant="outlined"
                            color="inherit"
                            startIcon={<FilterAltOutlinedIcon />}
                            onClick={openFilterSheet}
                            sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' }}
                        >
                            Фильтры
                        </Button>
                    </Badge>
                ) : (
                    <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<FilterAltOutlinedIcon />}
                        onClick={openFilterSheet}
                        sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' }}
                    >
                        Фильтры
                    </Button>
                )}
                <Button variant="contained" startIcon={<AddIcon />} onClick={openAddMenu} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                    Добавить
                </Button>
            </Box>

            {showNoTransactions ? (
                <EmptyState
                    title="Пока нет операций"
                    subtitle="Добавьте чек или транзакцию, чтобы начать учёт"
                    actionLabel="Добавить"
                    onAction={openAddMenu}
                />
            ) : showNotFound ? (
                <EmptyState
                    title="Ничего не найдено"
                    subtitle={
                        hasTableFilters
                            ? 'Попробуйте изменить период или сбросить фильтры'
                            : 'В этом периоде нет операций'
                    }
                    actionLabel={hasTableFilters ? 'Сбросить фильтры' : 'Показать всё время'}
                    onAction={() => {
                        if (hasTableFilters) {
                            handleResetFilters()
                        } else {
                            // Активных фильтров нет — период пуст; показываем все операции.
                            useUiStore.getState().setPeriodKey('all')
                        }
                    }}
                />
            ) : isMobile ? (
                <Stack spacing={1.25}>
                    {mobileLoading ? (
                        <LoadingState label="Загружаем операции…" />
                    ) : (
                        <>
                            {showSwipeHint && mobileRows.length > 0 && (
                                <Box
                                    role="status"
                                    sx={{
                                        display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25,
                                        border: '1px solid', borderColor: 'divider', borderRadius: '8px', bgcolor: 'background.paper',
                                    }}
                                >
                                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                                        Смахните операцию влево, чтобы быстро её изменить. С клавиатуры используйте F2.
                                    </Typography>
                                    <Button
                                        size="small"
                                        onClick={() => {
                                            rememberSwipeHint()
                                            setShowSwipeHint(false)
                                        }}
                                    >
                                        Понятно
                                    </Button>
                                </Box>
                            )}
                            <VirtualizedTransactionList
                                items={mobileRows}
                                renderItem={(t, index) => (
                                    <TransactionCard
                                        tx={t}
                                        tagsMap={tagsMap}
                                        swipeOpen={mobileSwipeId === t.id}
                                        expanded={expandedMobileId === t.id}
                                        animationIndex={index}
                                        highlighted={highlightedMobileId === t.id}
                                        onSwipeOpen={handleSwipeOpen}
                                        onExpandedChange={setExpandedMobileId}
                                        onEdit={openTransactionEditor}
                                        onTagEdit={openTagEditor}
                                    />
                                )}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                                Показано {mobileRows.length} из {total ?? 0} · свайп влево — изменить
                            </Typography>
                            {total !== null && mobileRows.length < total && !mobileLoadError && (
                                <Box ref={mobileSentinelRef} sx={{ minHeight: 52, display: 'grid', placeItems: 'center' }} aria-live="polite">
                                    {mobileLoadingMore && <CircularProgress size={22} aria-label="Загружаем следующие транзакции" />}
                                </Box>
                            )}
                            {mobileLoadError && (
                                <Button variant="outlined" color="inherit" onClick={() => void loadMoreMobile()} sx={{ color: 'text.primary', borderColor: 'divider' }}>
                                    Не удалось загрузить. Повторить
                                </Button>
                            )}
                        </>
                    )}
                </Stack>
            ) : (
                <Box
                    sx={{
                        position: 'relative',
                        flex: 1,
                        minHeight: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        minWidth: 0,
                    }}
                >
                    {/* Панель удаления выделенных строк — плавающая поверх таблицы,
              не толкает её вниз (absolute, не в потоке) */}
                    {selectedIds.length > 0 && (
                        <Box
                            sx={{
                                position: 'absolute',
                                bottom: 60,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                marginBottom: '10px',
                                gap: 1.5,
                                px: 1.75,
                                py: 1,
                                borderRadius: '8px',
                                border: `1px solid ${theme.palette.divider}`,
                                bgcolor: 'background.paper',
                                boxShadow: theme.shadows[6],
                            }}
                        >
                            <Typography variant="body2" color="text.secondary">
                                Выбрано: {selectedIds.length}
                            </Typography>
                            <Box sx={{ flex: 1 }} />
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<EditOutlinedIcon />}
                                onClick={() => setBulkEditOpen(true)}
                            >
                                Изменить
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => {
                                    setBulkError(null)
                                    setConfirmDeleteOpen(true)
                                }}
                                sx={{
                                    borderRadius: '8px',
                                    borderColor: colors.red,
                                    color: colors.red,
                                    '&:hover': { borderColor: colors.red, bgcolor: 'rgba(220, 38, 38, 0.08)' },
                                }}
                            >
                                Удалить ({selectedIds.length})
                            </Button>
                        </Box>
                    )}
                    <Suspense fallback={<LoadingState label="Загружаем таблицу…" />}>
                        <TransactionsGrid
                            params={params}
                            tagsMap={tagsMap}
                            total={total}
                            onTotalChange={setTotal}
                            onSelectionChange={setSelectedIds}
                            selectionResetRevision={selectionResetRevision}
                            onEdit={openTransactionEditor}
                        />
                    </Suspense>
                </Box>
            )}

            <FilterSheet tags={tags} stores={stores} />

            {/* Редактирование транзакции */}
            <EditTransactionDialog
                tx={editingTx}
                open={editOpen}
                onClose={closeTransactionEditor}
                updateInPlace={isMobile}
                onSaved={handleTransactionUpdated}
            />

            <QuickTagSheet
                tx={tagEditingTx}
                tags={tags ?? []}
                open={tagEditOpen}
                onClose={closeTagEditor}
                onSaved={handleTransactionUpdated}
            />

            {!isMobile && bulkEditOpen && (
                <Suspense fallback={null}>
                    <BulkEditSheet
                        open
                        selectedIds={selectedIds}
                        tags={tags ?? []}
                        stores={stores}
                        onClose={() => setBulkEditOpen(false)}
                        onSaved={() => {
                            setSelectedIds([])
                            setSelectionResetRevision((revision) => revision + 1)
                        }}
                    />
                </Suspense>
            )}

            {/* Подтверждение массового удаления */}
            <ConfirmDialog
                open={confirmDeleteOpen}
                title={`Удалить ${pluralRu(selectedIds.length, ['транзакцию', 'транзакции', 'транзакций'])}?`}
                message="Операция необратима. Транзакции, привязанные к чеку, будут удалены из чека."
                confirmLabel="Удалить"
                pending={deleteTx.isPending}
                error={bulkError}
                onConfirm={() => void bulkDelete()}
                onClose={() => setConfirmDeleteOpen(false)}
            />
        </Stack>
    )
}
