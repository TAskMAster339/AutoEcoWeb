import { Grid2 as Grid, Skeleton, useMediaQuery, useTheme } from '@mui/material'
import { useSummary } from '../../hooks/useSummary'
import { formatCurrency } from '../../lib/format'
import { StatisticCard } from '../common/StatisticCard'

/** Responsive presentation for the period totals above the transaction feed. */
export function TransactionSummaryCards() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { data, isLoading } = useSummary()

  if (isLoading) {
    return (
      <Grid container spacing={1.5}>
        {[0, 1, 2, 3].map((index) => (
          <Grid size={{ xs: 6, md: 3 }} key={index}>
            <Skeleton variant="rounded" height={108} sx={{ borderRadius: '8px' }} />
          </Grid>
        ))}
      </Grid>
    )
  }
  if (!data) return null

  const net = data.income - data.expenses
  return (
    <Grid container spacing={1.5}>
      <Grid size={{ xs: 6, md: 3 }}>
        <StatisticCard
          label="Баланс"
          value={formatCurrency(data.balance)}
          delta={net}
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
