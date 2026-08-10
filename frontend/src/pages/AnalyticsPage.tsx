import { useMemo } from 'react'
import { Box, Grid2 as Grid, Skeleton, Stack, useMediaQuery, useTheme } from '@mui/material'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CategoryIcon from '@mui/icons-material/Category'
import PaymentsIcon from '@mui/icons-material/Payments'
import StorefrontIcon from '@mui/icons-material/Storefront'
import { useNavigate } from 'react-router-dom'
import {
  ChartCard,
  DonutChart,
  LineChart,
  OTHER_SLICE_COLOR,
  WeekdayBars,
  mergeSmallSlices,
  storeColor,
  weekdayLabel,
} from '../components/analytics/Charts'
import { PriceChartCard } from '../components/analytics/PriceChartCard'
import { PeriodSelector } from '../components/common/PeriodSelector'
import { StatisticCard } from '../components/common/StatisticCard'
import { LoadingState, ErrorState, OfflineState } from '../components/common/States'
import { useAnalytics, useSummary } from '../hooks/useSummary'
import { useOnline } from '../hooks/useOnline'
import { formatCurrency, plural } from '../lib/format'
import { useUiStore } from '../store/uiStore'
import { colors } from '../theme'

/** Аналитика — расходы по дням (тренд), круговые по магазинам/категориям/доходам,
 *  траты по дням недели, индикаторы и график цен товара. Считает бэкенд. */
export function AnalyticsPage() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const navigate = useNavigate()
  const online = useOnline()

  const { data, isLoading, isError, error, refetch } = useAnalytics()
  const summary = useSummary()

  // Переход на транзакции с фильтром магазина(ов): «Другое» выбирает все
  // слитые магазины сразу (мульти-фильтр ?store=A&store=B). Сброс поиска и
  // тегов, чтобы фильтр доната был единственным; период сохраняется.
  const goToStore = (labels: string[]) => {
    const u = useUiStore.getState()
    u.setSearch('')
    u.setTagFilterIds([])
    navigate(`/transactions?${labels.map((l) => `store=${encodeURIComponent(l)}`).join('&')}`)
  }
  // Категории фильтруются по id тегов — мульти тоже поддерживается.
  const goToCategory = (ids: string[]) => {
    const u = useUiStore.getState()
    u.setSearch('')
    u.setStoreFilters([])
    navigate(`/transactions?${ids.map((id) => `tag=${encodeURIComponent(id)}`).join('&')}`)
  }

  const dailyPoints = useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        x: 0,
        label: d.day,
        value: d.expenses,
        meta: [
          { label: 'Доходы', value: formatCurrency(d.income), color: colors.green },
          { label: 'Операций', value: String(d.count) },
          { label: 'Баланс дня', value: formatCurrency(d.income - d.expenses) },
        ],
      })),
    [data],
  )
  const dailyTrend = useMemo(() => data?.daily.map((d) => d.trend) ?? [], [data])
  const totalExpenses = useMemo(() => (data?.daily ?? []).reduce((s, d) => s + d.expenses, 0), [data])
  const totalIncome = useMemo(() => (data?.daily ?? []).reduce((s, d) => s + d.income, 0), [data])

  // Пироги: доли < 1 % сливаются в «Другое» (несёт список слитых элементов
  // в `others` — по клику открываем транзакции со всеми магазинами сразу).
  const storeSlices = useMemo(() => {
    const colored = (data?.byStore ?? []).map((s, i) => ({ label: s.store, value: s.value, color: storeColor(i) }))
    return mergeSmallSlices(colored).map((s) => (s.label === 'Другое' ? { ...s, color: OTHER_SLICE_COLOR } : s))
  }, [data])
  const storeIncomeSlices = useMemo(() => {
    const colored = (data?.byStoreIncome ?? []).map((s, i) => ({ label: s.store, value: s.value, color: storeColor(i) }))
    return mergeSmallSlices(colored).map((s) => (s.label === 'Другое' ? { ...s, color: OTHER_SLICE_COLOR } : s))
  }, [data])
  const categorySlices = useMemo(() => {
    const colored = (data?.byCategory ?? []).map((c) => ({
      label: c.tag.name,
      value: c.value,
      color: c.tag.color,
      id: c.tag.id,
    }))
    return mergeSmallSlices(colored).map((s) =>
      s.label === 'Другое' ? { ...s, color: OTHER_SLICE_COLOR, id: undefined } : s,
    )
  }, [data])

  // Разность доходов и расходов за период — как на странице транзакций:
  // зелёная при >= 0, красная при < 0.
  const net = summary.data ? summary.data.income - summary.data.expenses : undefined

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

  const ind = data.indicators

  return (
    <Stack spacing={2.25}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between', alignItems: { sm: 'center' } }}>
        <PeriodSelector />
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatisticCard label="Расходы" value={formatCurrency(totalExpenses)} />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatisticCard label="Доходы" value={formatCurrency(totalIncome)} />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <StatisticCard
            label="Баланс"
            value={formatCurrency(summary.data?.balance ?? 0)}
            delta={net}
            // Спарклайн только на десктопе: на мобильном не помещается рядом с дельтой
            // (то же поведение, что на странице транзакций).
            sparkline={isMobile ? undefined : summary.data?.balanceTrend}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatisticCard
            label="Самый затратный магазин"
            value={ind.topStore ? formatCurrency(ind.topStore.value) : '—'}
            hint={ind.topStore ? ind.topStore.store : 'нет трат'}
            icon={<StorefrontIcon sx={{ color: 'text.secondary', fontSize: 20 }} />}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <StatisticCard
            label="Самая частая категория"
            value={ind.topCategory ? String(ind.topCategory.count) : '—'}
            hint={ind.topCategory ? ind.topCategory.tag.name : 'нет трат'}
            icon={
              ind.topCategory ? (
                <Box sx={{ width: 20, height: 20, borderRadius: '6px', bgcolor: ind.topCategory.tag.color }} />
              ) : (
                <CategoryIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
              )
            }
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <StatisticCard
            label="Самый покупаемый день"
            value={ind.topWeekday ? weekdayLabel(ind.topWeekday.weekday) : '—'}
            hint={ind.topWeekday ? `${ind.topWeekday.count} ${plural(ind.topWeekday.count, 'покупка', 'покупки', 'покупок')}` : 'нет трат'}
            icon={<CalendarMonthIcon sx={{ color: 'text.secondary', fontSize: 20 }} />}
          />
        </Grid>
        <Grid size={{ xs: 6, md: 4 }}>
          <StatisticCard
            label="Выгодный источник дохода"
            value={ind.topIncomeSource ? formatCurrency(ind.topIncomeSource.value) : '—'}
            hint={ind.topIncomeSource ? ind.topIncomeSource.store : 'нет доходов'}
            icon={<PaymentsIcon sx={{ color: 'text.secondary', fontSize: 20 }} />}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Расходы по дням">
            <LineChart
              points={dailyPoints}
              trend={dailyTrend}
              formatValue={formatCurrency}
              valueLabel="Расходы"
              ariaLabel="Расходы по дням с трендом"
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="По магазинам">
            <DonutChart
              items={storeSlices}
              formatValue={formatCurrency}
              centerLabel="расходы"
              getItemClick={(item) => () => {
                if (item.others) goToStore(item.others.map((o) => o.label))
                else goToStore([item.label])
              }}
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="Доходы по источникам">
            <DonutChart
              items={storeIncomeSlices}
              formatValue={formatCurrency}
              centerLabel="доходы"
              getItemClick={(item) => () => {
                if (item.others) goToStore(item.others.map((o) => o.label))
                else goToStore([item.label])
              }}
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <ChartCard title="По категориям">
            <DonutChart
              items={categorySlices}
              formatValue={formatCurrency}
              centerLabel="расходы"
              getItemClick={(item) => () => {
                const ids = item.others
                  ? item.others.map((o) => o.id).filter((id): id is string => Boolean(id))
                  : item.id
                    ? [item.id]
                    : []
                if (ids.length) goToCategory(ids)
              }}
            />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ChartCard title="Траты по дням недели">
            <WeekdayBars data={data.byWeekday} formatValue={formatCurrency} />
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <PriceChartCard />
        </Grid>
      </Grid>
    </Stack>
  )
}
