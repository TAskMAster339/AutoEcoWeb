import { useMemo, useState } from 'react'
import {
  Badge,
  Box,
  Button,
  Grid2 as Grid,
  IconButton,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useNavigate } from 'react-router-dom'
import { StatisticCard } from '../components/common/StatisticCard'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { rangeFor } from '../lib/period'
import { TransactionsGrid } from '../components/transactions/TransactionsGrid'
import { TransactionCard } from '../components/transactions/TransactionCard'
import { AddTransactionSheet } from '../components/transactions/AddTransactionSheet'
import { AddReceiptSheet } from '../components/transactions/AddReceiptSheet'
import { FilterSheet } from '../components/transactions/FilterSheet'
import { EditTransactionDialog } from '../components/transactions/EditTransactionDialog'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useSummary } from '../hooks/useSummary'
import { useTransactionViews, useDeleteTransaction } from '../hooks/useTransactions'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { useUiStore } from '../store/uiStore'
import { formatCurrency, pluralRu } from '../lib/format'
import { colors } from '../theme'
import type { TransactionView } from '../api/types'

function exportCsv(rows: TransactionView[]) {
  const header = ['Дата', 'Магазин', 'Теги', 'Название', 'Кол-во', 'Цена', 'Доход', 'Расход', 'Баланс', 'Комментарий']
  const lines = rows.map((t) =>
    [t.date, t.store, t.tagId ?? '', t.name, t.quantity ?? '', t.price ?? '', t.income ?? '', t.expense ?? '', t.balance, t.comment ?? '']
      .map((v) => `"${String(v).replaceAll('"', '""')}"`)
      .join(';'),
  )
  const csv = '\uFEFF' + [header.join(';'), ...lines].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'autoeco-transactions.csv'
  a.click()
  URL.revokeObjectURL(url)
}

function SummaryCards() {
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

  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatisticCard label="Баланс" value={formatCurrency(data.balance)} sparkline={data.balanceTrend} />
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
  const navigate = useNavigate()
  const online = useOnline()

  const { data, isLoading, isError, error, refetch } = useTransactionViews()
  const { data: tags } = useTags()
  const deleteTx = useDeleteTransaction()

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

  const periodKey = useUiStore((s) => s.periodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const search = useUiStore((s) => s.search)
  const tagFilterId = useUiStore((s) => s.tagFilterId)
  const storeFilter = useUiStore((s) => s.storeFilter)
  const openFilterSheet = useUiStore((s) => s.openFilterSheet)
  const openAddMenu = useUiStore((s) => s.openAddMenu)

  const tagsMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const stores = useMemo(() => [...new Set((data ?? []).map((t) => t.store).filter(Boolean))].sort() as string[], [data])

  const range = useMemo(() => rangeFor(periodKey, customFrom, customTo), [periodKey, customFrom, customTo])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.filter((t) => {
      if (t.date < range.from || t.date > range.to) return false
      if (tagFilterId && t.tagId !== tagFilterId) return false
      if (storeFilter && t.store !== storeFilter) return false
      if (q && !`${t.store ?? ''} ${t.name} ${t.comment ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [data, range, search, tagFilterId, storeFilter])

  const hasFilters = Boolean(search || tagFilterId || storeFilter || periodKey !== 'thisMonth')

  if (isLoading) return <LoadingState label="Загружаем операции…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

  return (
    <Stack spacing={2.25} sx={{ height: '100%' }}>
      <SummaryCards />

      {/* Toolbar: filters / export / period */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Badge color="primary" variant="dot" invisible={!hasFilters}>
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
        <Tooltip title="Скачать CSV">
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
            sx={{ color: 'text.primary', borderColor: 'divider', bgcolor: 'background.paper' }}
          >
            Экспорт
          </Button>
        </Tooltip>
        <Tooltip title="Настройки">
          <IconButton onClick={() => navigate('/settings')} aria-label="Настройки" sx={{ border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper', borderRadius: '8px' }}>
            <SettingsOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <PeriodSelector />
      </Box>

      {data && data.length === 0 ? (
        <EmptyState
          title="Пока нет операций"
          subtitle="Добавьте чек или транзакцию, чтобы начать учёт"
          actionLabel="Добавить"
          onAction={openAddMenu}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Ничего не найдено"
          subtitle="Попробуйте изменить период или сбросить фильтры"
          actionLabel="Сбросить фильтры"
          onAction={() => {
            useUiStore.getState().resetFilters()
          }}
        />
      ) : isMobile ? (
        <Stack spacing={1.25}>
          {filtered.map((t) => (
            <TransactionCard key={t.id} tx={t} tagsMap={tagsMap} onDelete={(id) => void deleteTx.mutate(id)} onEdit={setEditingTx} />
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', py: 1 }}>
            Показано {filtered.length} из {data?.length ?? 0} · свайп влево — удалить
          </Typography>
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
            rows={filtered}
            tagsMap={tagsMap}
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
