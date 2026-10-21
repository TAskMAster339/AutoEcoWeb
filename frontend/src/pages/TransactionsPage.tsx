import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Badge,
    Box,
    Button,
    CircularProgress,
    Collapse,
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
import { useQuery } from '@tanstack/react-query'
import { useOutletContext } from 'react-router-dom'

import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { TransactionCard } from '../components/transactions/TransactionCard'
import { VirtualizedTransactionList } from '../components/transactions/VirtualizedTransactionList'
import { FilterSheet } from '../components/transactions/FilterSheet'
import { EditTransactionDialog } from '../components/transactions/EditTransactionDialog'
import { QuickTagSheet } from '../components/transactions/QuickTagSheet'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useStores } from '../hooks/useTransactions'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { useUiStore } from '../store/uiStore'
import { useFilterParams } from '../lib/filters'
import { fetchTransactionsPage } from '../api/transactions'
import { pluralRu } from '../lib/format'
import { colors, softBg, softFg } from '../theme'
import { PageSearch } from '../components/common/PageSearch'
import type { Transaction, TransactionUpdatePatch, TransactionView } from '../api/types'
import { canStartMobileSelection, hasActiveTableFilters, nextOpenSwipeId } from '../lib/transactionInteractions'
import { queryKeys } from '../lib/queryKeys'
import { useTransactionFilterUrl } from '../hooks/useTransactionFilterUrl'
import { useMobileTransactionFeed } from '../hooks/useMobileTransactionFeed'
import { useTransactionSelection } from '../hooks/useTransactionSelection'
import { TransactionSummaryCards } from '../components/transactions/TransactionSummaryCards'

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

/** Таблица — the main screen from the designer's mockup. */
export function TransactionsPage() {
    useTransactionFilterUrl()
    const theme = useTheme()
    const isMobile = useMediaQuery(theme.breakpoints.down('md'))
    const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
    const online = useOnline()
    const scrollContainer = useOutletContext<HTMLElement | null>()

    const storeFilters = useUiStore((s) => s.storeFilters)
    const amountMin = useUiStore((s) => s.amountMin)
    const amountMax = useUiStore((s) => s.amountMax)
    const operationFilter = useUiStore((s) => s.operationFilter)
    // Параметры фильтров (период/тег/поиск/магазин) — применяет бэкенд.
    const params = useFilterParams()

    const { data: tags } = useTags()
    const { data: stores = [] } = useStores()

    // Сколько транзакций у пользователя ВООБЩЕ (без фильтров) — для различения
    // «Пока нет операций» (пустая учётка) и «Ничего не найдено» (пустой период).
    // Заодно это «гейт» загрузки страницы: пока нет ответа — спиннер.
    const {
        data: allTimeTotal,
        isLoading: totalLoading,
        isError: totalError,
        refetch,
    } = useQuery({
        queryKey: queryKeys.transactions.total(),
        queryFn: async ({ signal }) => {
            const page = await fetchTransactionsPage({ limit: 1 }, signal)
            return page.total ?? 0
        },
        staleTime: 30_000,
    })

    const [desktopTotal, setDesktopTotal] = useState<number | null>(null)
    const mobileFeed = useMobileTransactionFeed({ enabled: isMobile, online, params, scrollContainer })
    const { query: mobileQuery, rows: mobileRows, total: mobileTotal, loadMore: loadMoreMobile } = mobileFeed
    const total = isMobile ? mobileTotal : desktopTotal

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
    }, [params])

    const selection = useTransactionSelection(isMobile)
    const {
        selectedIds, setSelectedIds, confirmDeleteOpen, setConfirmDeleteOpen,
        bulkEditOpen, setBulkEditOpen, selectionResetRevision, bulkError, setBulkError,
        mobileSelectionMode, toggleMobileSelection, closeMobileSelection, resetSelection, bulkDelete,
    } = selection
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
        mobileFeed.updateCachedTransaction(updated, patch)
        handleTransactionSaved(updated.id)
    }, [handleTransactionSaved, mobileFeed])

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
        selection.startMobileSelection(id)
    }, [selection])

    const openFilterSheet = useUiStore((s) => s.openFilterSheet)
    const openAddMenu = useUiStore((s) => s.openAddMenu)
    const search = useUiStore((s) => s.search)
    const tagFilterIds = useUiStore((s) => s.tagFilterIds)
    const untaggedOnly = useUiStore((s) => s.untaggedOnly)
    const resetFilters = useUiStore((s) => s.resetFilters)

    const handleResetFilters = () => {
        resetFilters()
    }

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
            <TransactionSummaryCards />

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
                            resetSelection()
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
                pending={selection.deletePending}
                error={bulkError}
                onConfirm={() => void bulkDelete()}
                onClose={() => setConfirmDeleteOpen(false)}
            />
        </Stack>
    )
}
