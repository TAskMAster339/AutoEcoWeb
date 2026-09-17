import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Badge,
    Box,
    Button,
    CircularProgress,
    Collapse,
    Grid2 as Grid,
    Skeleton,
    Slide,
    Stack,
    IconButton,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import AddIcon from '@mui/icons-material/Add'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import CloseIcon from '@mui/icons-material/Close'
import SelectAllIcon from '@mui/icons-material/SelectAll'
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'

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
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { useUiStore } from '../store/uiStore'
import { useFilterParams } from '../lib/filters'
import { fetchTransactionsPage, toTransactionView } from '../api/transactions'
import { formatCurrency, pluralRu } from '../lib/format'
import { normalizeAmountFilter } from '../lib/numbers'
import { colors, softBg, softFg } from '../theme'
import { PageSearch } from '../components/common/PageSearch'
import type { Transaction, TransactionUpdatePatch, TransactionView } from '../api/types'
import { canStartMobileSelection, hasActiveTableFilters, nextOpenSwipeId, replaceTransactionInPlace, toggleSelectedId } from '../lib/transactionInteractions.mjs'
import { nextPageOffset } from '../lib/mobilePagination.mjs'

/** Размер автоматически подгружаемой страницы мобильного списка. */
const MOBILE_PAGE = 50
interface MobileTransactionPage {
    items: TransactionView[]
    total: number | null
}

function replaceTransactionInPages(
    data: InfiniteData<MobileTransactionPage> | undefined,
    updated: Transaction,
    patch: TransactionUpdatePatch,
): InfiniteData<MobileTransactionPage> | undefined {
    if (!data || !updated.id) return data
    const currentRows = data.pages.flatMap((page) => page.items)
    const updatedView = toTransactionView(updated)
    const preserveInheritedStore = !('seller_name' in patch) && updatedView.store === null
    const nextRows = replaceTransactionInPlace(currentRows, updatedView, preserveInheritedStore)
    if (nextRows === currentRows) return data

    let cursor = 0
    return {
        ...data,
        pages: data.pages.map((page) => {
            const items = nextRows.slice(cursor, cursor + page.items.length)
            cursor += page.items.length
            return { ...page, items }
        }),
    }
}

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
    const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
    const online = useOnline()
    const queryClient = useQueryClient()
    const scrollContainer = useOutletContext<HTMLElement | null>()

    const storeFilters = useUiStore((s) => s.storeFilters)
    const amountMin = useUiStore((s) => s.amountMin)
    const amountMax = useUiStore((s) => s.amountMax)
    const operationFilter = useUiStore((s) => s.operationFilter)
    const setTransactionSelectionMode = useUiStore((s) => s.setTransactionSelectionMode)
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

    const [desktopTotal, setDesktopTotal] = useState<number | null>(null)
    const mobileQueryKey = useMemo(
        () => ['txPage', 'mobile', params, 'date', 'asc', MOBILE_PAGE, txRevision] as const,
        [params, txRevision],
    )

    const mobileQuery = useInfiniteQuery({
        queryKey: mobileQueryKey,
        queryFn: async ({ pageParam }) => {
            const page = await fetchTransactionsPage({
                limit: MOBILE_PAGE,
                offset: pageParam,
                ...params,
                sort_by: 'date',
                sort_dir: 'asc',
            })
            return {
                items: page.items.map(toTransactionView),
                total: page.total ?? 0,
            } satisfies MobileTransactionPage
        },
        initialPageParam: 0,
        getNextPageParam: (_lastPage, pages) => nextPageOffset(pages),
        enabled: isMobile && online,
        staleTime: 30_000,
    })
    const mobileRows = useMemo(
        () => mobileQuery.data?.pages.flatMap((page) => page.items) ?? [],
        [mobileQuery.data],
    )
    const mobilePages = mobileQuery.data?.pages
    const mobileTotal = mobilePages && mobilePages.length > 0
        ? mobilePages[mobilePages.length - 1]?.total ?? null
        : null
    const total = isMobile ? mobileTotal : desktopTotal
    const loadMoreMobile = useCallback(async () => {
        await mobileQuery.fetchNextPage().catch(() => undefined)
    }, [mobileQuery.fetchNextPage])

    useInfiniteScroll({
        container: scrollContainer,
        enabled: isMobile
            && online
            && mobileQuery.hasNextPage
            && !mobileQuery.isFetchingNextPage
            && !mobileQuery.isFetchNextPageError,
        itemCount: mobileRows.length,
        onLoadMore: loadMoreMobile,
    })

    const [mobileSwipeId, setMobileSwipeId] = useState<string | null>(null)
    const [expandedMobileId, setExpandedMobileId] = useState<string | null>(null)
    const [showSwipeHint, setShowSwipeHint] = useState(() => !hasSeenSwipeHint())
    const [highlightedMobileId, setHighlightedMobileId] = useState<string | null>(null)
    const highlightTimerRef = useRef<number | null>(null)
    const editOpenFrameRef = useRef<number | null>(null)
    const editOpenRef = useRef(false)
    const editingTxIdRef = useRef<string | null>(null)

    useEffect(() => () => {
        if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
        if (editOpenFrameRef.current !== null) window.cancelAnimationFrame(editOpenFrameRef.current)
    }, [])

    useEffect(() => {
        if (!isMobile || !mobileSwipeId || !scrollContainer) return
        const closeSwipe = () => setMobileSwipeId(null)
        const closeOnOutsidePointer = (event: PointerEvent) => {
            const target = event.target instanceof Element ? event.target : null
            const card = target?.closest<HTMLElement>('[data-mobile-transaction-id]')
            if (card?.dataset.mobileTransactionId !== mobileSwipeId) closeSwipe()
        }
        scrollContainer.addEventListener('scroll', closeSwipe, { passive: true })
        document.addEventListener('pointerdown', closeOnOutsidePointer)
        return () => {
            scrollContainer.removeEventListener('scroll', closeSwipe)
            document.removeEventListener('pointerdown', closeOnOutsidePointer)
        }
    }, [isMobile, mobileSwipeId, scrollContainer])

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

    useEffect(() => {
        setMobileSwipeId(null)
    }, [params, txRevision])

    // Выбранные в таблице строки (чекбоксы) → панель «Удалить (N)».
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
    const [bulkEditOpen, setBulkEditOpen] = useState(false)
    const [mobileSelectionActive, setMobileSelectionActive] = useState(false)
    const [selectionResetRevision, setSelectionResetRevision] = useState(0)
    const [bulkError, setBulkError] = useState<string | null>(null)
    const mobileSelectionMode = isMobile && mobileSelectionActive

    useEffect(() => {
        setTransactionSelectionMode(mobileSelectionMode)
    }, [mobileSelectionMode, setTransactionSelectionMode])

    useEffect(() => () => {
        setTransactionSelectionMode(false)
    }, [setTransactionSelectionMode])
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
            queryClient.setQueryData<InfiniteData<MobileTransactionPage>>(
                mobileQueryKey,
                (data) => replaceTransactionInPages(data, updated, patch),
            )
        }
        handleTransactionSaved(updated.id)
    }, [handleTransactionSaved, mobileQueryKey, queryClient])

    const openTagEditor = useCallback((tx: TransactionView) => {
        setTagEditingTx(tx)
        setTagEditOpen(true)
    }, [])

    const closeTagEditor = useCallback(() => {
        setTagEditOpen(false)
    }, [])

    const startMobileSelection = useCallback((id: string) => {
        if (!canStartMobileSelection(editOpenRef.current, editOpenFrameRef.current !== null)) return
        setExpandedMobileId(null)
        setMobileSwipeId(null)
        setMobileSelectionActive(true)
        setSelectedIds([id])
    }, [])

    const toggleMobileSelection = useCallback((id: string) => {
        const nextSelectedIds = toggleSelectedId(selectedIds, id)
        setSelectedIds(nextSelectedIds)
        if (nextSelectedIds.length === 0) setMobileSelectionActive(false)
    }, [selectedIds])

    const closeMobileSelection = useCallback(() => {
        setMobileSelectionActive(false)
        setSelectedIds([])
        setBulkError(null)
    }, [])

    useEffect(() => {
        if (!mobileSelectionMode) return
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') closeMobileSelection()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [closeMobileSelection, mobileSelectionMode])

    const bulkDelete = async () => {
        setBulkError(null)
        try {
            await Promise.all(selectedIds.map((id) => deleteTx.mutateAsync(id)))
            setSelectedIds([])
            setMobileSelectionActive(false)
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
                    {mobileQuery.isPending ? (
                        <LoadingState label="Загружаем операции…" />
                    ) : mobileQuery.isError && mobileRows.length === 0 ? (
                        <ErrorState
                            message="Не удалось загрузить операции"
                            onRetry={() => void mobileQuery.refetch()}
                        />
                    ) : (
                        <>
                            <Box sx={{ position: 'sticky', top: 0, zIndex: 8 }}>
                                <Collapse
                                    in={mobileSelectionMode}
                                    timeout={reduceMotion ? 100 : { enter: 240, exit: 160 }}
                                    unmountOnExit
                                >
                                    <Box
                                        role="toolbar"
                                        aria-label="Управление режимом выбора"
                                        sx={{
                                            display: 'grid',
                                            gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            px: 1,
                                            py: 0.75,
                                            border: '1px solid',
                                            borderColor: 'primary.main',
                                            borderRadius: '8px',
                                            bgcolor: 'background.paper',
                                            boxShadow: theme.shadows[4],
                                        }}
                                    >
                                        <Button
                                            size="small"
                                            variant="outlined"
                                            startIcon={<SelectAllIcon />}
                                            onClick={() => setSelectedIds(mobileRows.map((row) => row.id))}
                                            disabled={selectedIds.length === mobileRows.length}
                                            sx={{ justifySelf: 'start', minWidth: 0, px: 0.75, whiteSpace: 'nowrap', fontSize: 12 }}
                                        >
                                            Выбрать всё
                                        </Button>
                                        <Typography
                                            aria-live="polite"
                                            sx={{ textAlign: 'center', fontWeight: 700, whiteSpace: 'nowrap' }}
                                        >
                                            Выбрано: {selectedIds.length}
                                        </Typography>
                                        <IconButton
                                            onClick={closeMobileSelection}
                                            aria-label="Выйти из режима выбора"
                                            sx={{ justifySelf: 'end' }}
                                        >
                                            <CloseIcon />
                                        </IconButton>
                                    </Box>
                                </Collapse>
                            </Box>
                            {!mobileSelectionMode && showSwipeHint && mobileRows.length > 0 && (
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
                                scrollContainer={scrollContainer}
                                renderItem={(t, index) => (
                                    <TransactionCard
                                        tx={t}
                                        tagsMap={tagsMap}
                                        swipeOpen={mobileSwipeId === t.id}
                                        expanded={expandedMobileId === t.id}
                                        animationIndex={index}
                                        highlighted={highlightedMobileId === t.id}
                                        selected={selectedIds.includes(t.id)}
                                        selectionMode={mobileSelectionMode}
                                        onSwipeOpen={handleSwipeOpen}
                                        onExpandedChange={setExpandedMobileId}
                                        onEdit={openTransactionEditor}
                                        onTagEdit={openTagEditor}
                                        onSelectionStart={startMobileSelection}
                                        onSelectionToggle={toggleMobileSelection}
                                    />
                                )}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                                {mobileSelectionMode
                                    ? `Показано ${mobileRows.length} из ${total ?? 0} · касание — выбрать`
                                    : `Показано ${mobileRows.length} из ${total ?? 0} · удерживайте для выбора`}
                            </Typography>
                            {mobileQuery.hasNextPage && (
                                <Stack spacing={0.75} sx={{ alignItems: 'center', py: 0.5 }} aria-live="polite">
                                    {mobileQuery.isFetchNextPageError && (
                                        <Typography variant="caption" color="error.main">
                                            Не удалось загрузить следующие транзакции
                                        </Typography>
                                    )}
                                    <Button
                                        variant="outlined"
                                        color="inherit"
                                        onClick={() => void loadMoreMobile()}
                                        disabled={mobileQuery.isFetchingNextPage}
                                        startIcon={mobileQuery.isFetchingNextPage ? <CircularProgress size={16} color="inherit" /> : undefined}
                                        sx={{ color: 'text.primary', borderColor: 'divider' }}
                                    >
                                        {mobileQuery.isFetchingNextPage
                                            ? 'Загружаем…'
                                            : mobileQuery.isFetchNextPageError
                                                ? 'Повторить загрузку'
                                                : 'Загрузить ещё'}
                                    </Button>
                                </Stack>
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
                    <Suspense fallback={<LoadingState label="Загружаем таблицу…" />}>
                        <TransactionsGrid
                            params={params}
                            tagsMap={tagsMap}
                            total={total}
                            onTotalChange={setDesktopTotal}
                            onSelectionChange={setSelectedIds}
                            selectionResetRevision={selectionResetRevision}
                            onEdit={openTransactionEditor}
                        />
                    </Suspense>
                    {selectedIds.length > 0 && (
                        <Box
                            role="toolbar"
                            aria-label="Действия с выбранными транзакциями"
                            sx={{
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'flex-end',
                                gap: 1.5,
                                mt: 1,
                                px: 1.75,
                                py: 1,
                                borderRadius: '8px',
                                bgcolor: 'background.paper',
                                boxShadow: theme.shadows[2],
                            }}
                        >
                            <Typography variant="body2" color="text.secondary" sx={{ mr: 'auto' }}>
                                Выбрано: {selectedIds.length}
                            </Typography>
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
                </Box>
            )}

            <Slide
                in={mobileSelectionMode}
                direction="up"
                timeout={reduceMotion ? 0 : { enter: 260, exit: 170 }}
                mountOnEnter
                unmountOnExit
            >
                <Box
                    role="toolbar"
                    aria-label="Действия с выбранными транзакциями"
                    sx={{
                        position: 'fixed',
                        zIndex: 1201,
                        left: 12,
                        right: 12,
                        bottom: 'calc(12px + env(safe-area-inset-bottom))',
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 1,
                        p: 0.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: '12px',
                        bgcolor: 'background.paper',
                        boxShadow: theme.palette.mode === 'dark'
                            ? '0 12px 36px rgba(0,0,0,0.55)'
                            : '0 12px 36px rgba(16,24,40,0.16)',
                    }}
                >
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => {
                            setBulkError(null)
                            setConfirmDeleteOpen(true)
                        }}
                        disabled={selectedIds.length === 0}
                        sx={{ minHeight: 54 }}
                    >
                        Удалить
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => setBulkEditOpen(true)}
                        disabled={selectedIds.length === 0}
                        sx={{ minHeight: 54 }}
                    >
                        Изменить ({selectedIds.length})
                    </Button>
                </Box>
            </Slide>

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

            {bulkEditOpen && (
                <Suspense fallback={null}>
                    <BulkEditSheet
                        open
                        selectedIds={selectedIds}
                        tags={tags ?? []}
                        stores={stores}
                        onClose={() => setBulkEditOpen(false)}
                        onSaved={() => {
                            setSelectedIds([])
                            setMobileSelectionActive(false)
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
