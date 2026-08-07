import { useMemo } from 'react'
import { Stack, Typography, useMediaQuery, useTheme } from '@mui/material'
import { ReceiptCard } from '../components/dashboard/ReceiptCard'
import { buildReceipts } from '../lib/receipts'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { rangeFor } from '../lib/period'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { AddTransactionSheet } from '../components/transactions/AddTransactionSheet'
import { useTransactions } from '../hooks/useTransactions'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { useUiStore } from '../store/uiStore'
import { formatCurrency } from '../lib/format'
import { colors } from '../theme'

/** Чеки — receipt cards grouped by store+date (mobile-first). */
export function DashboardPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const online = useOnline()

  const { data, isLoading, isError, error, refetch } = useTransactions()
  const { data: tags } = useTags()
  const periodKey = useUiStore((s) => s.periodKey)
  const customFrom = useUiStore((s) => s.customFrom)
  const customTo = useUiStore((s) => s.customTo)
  const search = useUiStore((s) => s.search)
  const openAddSheet = useUiStore((s) => s.openAddSheet)

  const tagsMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const range = useMemo(() => rangeFor(periodKey, customFrom, customTo), [periodKey, customFrom, customTo])

  const receipts = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    const inRange = data.filter((t) => t.date >= range.from && t.date <= range.to)
    const searched = q
      ? inRange.filter((t) => `${t.store} ${t.description}`.toLowerCase().includes(q))
      : inRange
    return buildReceipts(searched)
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
            ? `${receipts.length} чеков · расход ${formatCurrency(totalSpent)}`
            : 'За выбранный период'}
        </Typography>
        <PeriodSelector />
      </Stack>

      {receipts.length === 0 ? (
        <EmptyState
          title="Чеков пока нет"
          subtitle="Отсканируйте или добавьте первый чек"
          actionLabel="Добавить чек"
          onAction={openAddSheet}
        />
      ) : (
        <Stack spacing={1.25} sx={{ maxWidth: isMobile ? '100%' : 760, mx: 'auto', width: '100%' }}>
          {receipts.map((r) => (
            <ReceiptCard key={r.id} receipt={r} tagsMap={tagsMap} />
          ))}
          <Typography variant="caption" color={colors.textSecondary} sx={{ textAlign: 'center', py: 1 }}>
            Показано {receipts.length} чеков
          </Typography>
        </Stack>
      )}

      <AddTransactionSheet />
    </Stack>
  )
}
