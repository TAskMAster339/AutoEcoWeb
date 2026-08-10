import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Grid2 as Grid,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { StatisticCard } from '../components/common/StatisticCard'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { TransactionsGrid } from '../components/transactions/TransactionsGrid'
import { TransactionCard } from '../components/transactions/TransactionCard'
import { AddTransactionSheet } from '../components/transactions/AddTransactionSheet'
import { AddReceiptSheet } from '../components/transactions/AddReceiptSheet'
import { FilterSheet } from '../components/transactions/FilterSheet'
import { EditTransactionDialog } from '../components/transactions/EditTransactionDialog'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useSummary } from '../hooks/useSummary'
import { useStores, useDeleteTransaction } from '../hooks/useTransactions'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { useUiStore } from '../store/uiStore'
import { useFilterParams } from '../lib/filters'
import { fetchTransactionsPage, toTransactionView } from '../api/transactions'
import { formatCurrency, pluralRu } from '../lib/format'
import { colors } from '../theme'
import type { TransactionView } from '../api/types'

/** Размер страницы мобильного списка (карточки, кнопка «Показать ещё»). */
const MOBILE_PAGE = 50

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

  // Смена фильтров/периода → сброс списка и первая страница.
  useEffect(() => {
    let cancelled = false
    setMobileLoading(true)
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
    setMobileLoadingMore(true)
    try {
      const page = await queryClient.fetchQuery({
        queryKey: ['txPage', params, 'date', 'asc', MOBILE_PAGE, mobileRows.length],
        queryFn: () => fetchTransactionsPage({ limit: MOBILE_PAGE, offset: mobileRows.length, ...params, sort_by: 'date', sort_dir: 'asc' }),
        staleTime: 30_000,
      })
      setMobileRows((prev) => [...prev, ...page.items.map(toTransactionView)])
      setTotal(page.total ?? 0)
    } finally {
      setMobileLoadingMore(false)
    }
  }, [params, queryClient, mobileRows.length])

  // Выбранные в таблице строки (чекбоксы) → панель «Удалить (N)».
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [bulkError, setBulkError] = useState<string | null>(null)
  // Транзакция для модалки редактирования (null = закрыта).
  const [editingTx, setEditingTx] = useState<TransactionView | null>(null)

  const bulkDelete = async () => {
    setBulkError(null)
    try {
      await Promise.all(selectedIds.map((id) => deleteTx.mutateAsync(id)))
      setSelectedIds([])
      setConfirmDeleteOpen(false)
    } catch (e) {
      setBulkError(e instanceof Error ? e.message : 'Не удалось удалить транзакции')
    }
  }

  const openFilterSheet = useUiStore((s) => s.openFilterSheet)
  const openAddMenu = useUiStore((s) => s.openAddMenu)
  const search = useUiStore((s) => s.search)
  const tagFilterIds = useUiStore((s) => s.tagFilterIds)
  const storeFilters = useUiStore((s) => s.storeFilters)
  const periodKey = useUiStore((s) => s.periodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const monthYear = useUiStore((s) => s.monthYear)
  const resetFilters = useUiStore((s) => s.resetFilters)

  // Применённые фильтры можно сохранить/открыть ссылкой.
  const urlInitialized = useRef(false)
  useEffect(() => {
    if (urlInitialized.current) return
    const query = new URLSearchParams(window.location.search)
    const state = useUiStore.getState()
    const urlSearch = query.get('search')
    const urlTags = query.getAll('tag')
    const urlStores = query.getAll('store')
    const urlPeriod = query.get('period')
    const urlFrom = query.get('from')
    const urlTo = query.get('to')
    const urlMonth = query.get('month')
    if (urlSearch !== null) state.setSearch(urlSearch)
    if (urlTags.some(Boolean)) state.setTagFilterIds(urlTags.filter(Boolean))
    if (urlStores.some(Boolean)) state.setStoreFilters(urlStores.filter(Boolean))
    if (urlFrom && urlTo) state.setCustomRange(urlFrom, urlTo)
    else if (urlMonth) state.setMonthPeriod(urlMonth)
    else if (urlPeriod) state.setPeriodKey(urlPeriod as Parameters<typeof state.setPeriodKey>[0])
    urlInitialized.current = true
  }, [])

  useEffect(() => {
    if (!urlInitialized.current) return
    const query = new URLSearchParams()
    if (search) query.set('search', search)
    if (tagFilterIds.length) tagFilterIds.forEach((id) => query.append('tag', id))
    if (storeFilters.length) storeFilters.forEach((store) => query.append('store', store))
    if (periodKey !== 'all') query.set('period', periodKey)
    if (periodKey === 'custom' && customFrom && customTo) {
      query.set('from', customFrom)
      query.set('to', customTo)
    }
    if (periodKey === 'month' && monthYear) query.set('month', monthYear)
    const next = query.toString()
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    if (nextUrl !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history.replaceState(null, '', nextUrl)
    }
  }, [search, tagFilterIds, storeFilters, periodKey, customFrom, customTo, monthYear])

  const tagsMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const hasFilters = Boolean(search || tagFilterIds.length || storeFilters.length || periodKey !== 'all')

  const showNoTransactions = total === 0 && (allTimeTotal ?? 0) === 0 && !hasFilters
  const showNotFound = total === 0 && !showNoTransactions

  if (totalLoading) return <LoadingState label="Загружаем операции…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (totalError) return <ErrorState message="Не удалось загрузить операции" onRetry={() => void refetch()} />

  return (
    <Stack spacing={2.25} sx={{ height: '100%' }}>
      <SummaryCards />

      {/* Toolbar: filters / export / period */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        {hasFilters ? (
          <Badge color="primary" variant="dot">
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
        <Button
          variant="text"
          color="inherit"
          onClick={resetFilters}
          disabled={!hasFilters}
          sx={{ color: 'text.secondary', textTransform: 'none' }}
        >
          Сбросить фильтры
        </Button>
        <Box sx={{ flex: 1 }} />
        <PeriodSelector />
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
            hasFilters
              ? 'Попробуйте изменить период или сбросить фильтры'
              : 'В этом периоде нет операций'
          }
          actionLabel={hasFilters ? 'Сбросить фильтры' : 'Показать всё время'}
          onAction={() => {
            if (hasFilters) {
              useUiStore.getState().resetFilters()
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
              {mobileRows.map((t) => (
                <TransactionCard key={t.id} tx={t} tagsMap={tagsMap} onDelete={(id) => void deleteTx.mutate(id)} onEdit={setEditingTx} />
              ))}
              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
                Показано {mobileRows.length} из {total ?? 0} · свайп влево — удалить
              </Typography>
              {total !== null && mobileRows.length < total && (
                <Button variant="outlined" color="inherit" onClick={() => void loadMoreMobile()} disabled={mobileLoadingMore} sx={{ color: 'text.primary', borderColor: 'divider' }}>
                  {mobileLoadingMore ? 'Загружаем…' : 'Показать ещё'}
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
          <TransactionsGrid
            params={params}
            tagsMap={tagsMap}
            total={total}
            onTotalChange={setTotal}
            onSelectionChange={setSelectedIds}
            onEdit={setEditingTx}
          />
        </Box>
      )}

      <AddTransactionSheet />
      <AddReceiptSheet />
      <FilterSheet tags={tags} stores={stores} />

      {/* Редактирование транзакции */}
      <EditTransactionDialog tx={editingTx} onClose={() => setEditingTx(null)} />

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
