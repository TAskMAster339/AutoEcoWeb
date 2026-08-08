import { useMemo } from 'react'
import { Button, Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { ReceiptCard } from '../components/dashboard/ReceiptCard'
import { mapReceipt } from '../lib/receipts'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { rangeFor } from '../lib/period'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { AddTransactionSheet } from '../components/transactions/AddTransactionSheet'
import { AddReceiptSheet } from '../components/transactions/AddReceiptSheet'
import { useReceipts } from '../hooks/useReceipts'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { useUiStore } from '../store/uiStore'
import { formatCurrency, pluralRu } from '../lib/format'
import { colors } from '../theme'

/** Чеки — receipt cards из реального /api/v1/receipts (новые сверху, «Загрузить ещё»). */
export function DashboardPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const online = useOnline()

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useReceipts()
  const { data: tags } = useTags()
  const periodKey = useUiStore((s) => s.periodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const search = useUiStore((s) => s.search)
  const openAddMenu = useUiStore((s) => s.openAddMenu)

  const tagsMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const range = useMemo(() => rangeFor(periodKey, customFrom, customTo), [periodKey, customFrom, customTo])

  const receipts = useMemo(() => {
    const all = data?.pages.flatMap((p) => p.items) ?? []
    const q = search.trim().toLowerCase()
    const inRange = all
      .filter((r) => r.datetime.slice(0, 10) >= range.from && r.datetime.slice(0, 10) <= range.to)
      .map(mapReceipt)
    return q
      ? inRange.filter((r) =>
          `${r.store} ${r.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q),
        )
      : inRange
  }, [data, range, search])

  const totalSpent = receipts.reduce((s, r) => s + (r.isIncome ? 0 : r.total), 0)

  if (isLoading) return <LoadingState label="Загружаем чеки…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
        <Typography variant="body2" color="text.secondary">
          {receipts.length > 0
            ? `${pluralRu(receipts.length, ['чек', 'чека', 'чеков'])} · расход ${formatCurrency(totalSpent)}`
            : 'За выбранный период'}
        </Typography>
        <PeriodSelector />
      </Stack>

      {receipts.length === 0 ? (
        <EmptyState
          title="Чеков пока нет"
          subtitle="Отсканируйте чек или добавьте транзакцию"
          actionLabel="Добавить"
          onAction={openAddMenu}
        />
      ) : (
        <Stack spacing={1.25} sx={{ maxWidth: isMobile ? '100%' : 760, mx: 'auto', width: '100%' }}>
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} tagsMap={tagsMap} />
          ))}
          {hasNextPage && (
            <Button
              variant="outlined"
              color="inherit"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              sx={{ alignSelf: 'center', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary' }}
            >
              {isFetchingNextPage ? 'Загружаем…' : 'Загрузить ещё'}
            </Button>
          )}
          <Typography variant="caption" color={colors.textSecondary} sx={{ textAlign: 'center', py: 1 }}>
            Показано {pluralRu(receipts.length, ['чек', 'чека', 'чеков'])}
          </Typography>
        </Stack>
      )}

      <AddTransactionSheet />
      <AddReceiptSheet />
    </Stack>
  )
}
