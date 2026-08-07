import { Stack, Grid2 as Grid, Skeleton, useMediaQuery, useTheme } from '@mui/material'
import { BarChart, ChartCard, HorizontalBars } from '../components/analytics/Charts'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { StatisticCard } from '../components/common/StatisticCard'
import { LoadingState, ErrorState, OfflineState } from '../components/common/States'
import { useAnalytics, useSummary } from '../hooks/useSummary'
import { useOnline } from '../hooks/useOnline'
import { formatCurrency } from '../lib/format'

/** Аналитика — daily expenses chart, by-store and by-tag breakdowns. */
export function AnalyticsPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const online = useOnline()

  const { data, isLoading, isError, error, refetch } = useAnalytics()
  const summary = useSummary()

  if (isLoading) {
    return (
      <Stack spacing={2}>
        <Skeleton variant="rounded" height={96} sx={{ borderRadius: '8px' }} />
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: '8px' }} />
      </Stack>
    )
  }
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />
  if (!data) return <LoadingState />

  return (
    <Stack spacing={2.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
        <Stack direction="row" spacing={1.5} sx={{ width: { xs: '100%', sm: 'auto' } }}>
          <StatisticCard
            label="Расходы"
            value={formatCurrency(data.daily.reduce((s, d) => s + d.expenses, 0))}
          />
          <StatisticCard
            label="Доходы"
            value={formatCurrency(data.daily.reduce((s, d) => s + d.income, 0))}
          />
        </Stack>
        <PeriodSelector />
      </Stack>

      {!isMobile && summary.data && (
        <StatisticCard label="Баланс" value={formatCurrency(summary.data.balance)} sparkline={summary.data.balanceTrend} />
      )}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <ChartCard title="Расходы по дням">
            <BarChart data={data.daily} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <ChartCard title="По магазинам">
            <HorizontalBars items={data.byStore.map((s) => ({ label: s.store, value: s.value }))} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="По тегам">
            <HorizontalBars
              items={data.byTag.map((t) => ({ label: t.tag.name, value: t.value, color: t.tag.color }))}
            />
          </ChartCard>
        </Grid>
      </Grid>
    </Stack>
  )
}
