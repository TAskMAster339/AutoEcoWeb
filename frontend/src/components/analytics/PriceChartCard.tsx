import { useEffect, useMemo, useState } from 'react'
import { Box, Card, Grid2 as Grid, Skeleton, Stack, Switch, TextField, Typography } from '@mui/material'
import { LineChart, storeColor } from './Charts'
import { StatisticCard } from '../common/StatisticCard'
import { ErrorState } from '../common/States'
import { usePriceChart } from '../../hooks/useSummary'
import { formatCurrency, plural } from '../../lib/format'

const DEBOUNCE_MS = 400

/** График цен товара (название или regex) — точки по магазинам, медиана, статистика. */
export function PriceChartCard() {
  const [name, setName] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [debounced, setDebounced] = useState('')

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(name), DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [name])

  const query = usePriceChart(debounced, isRegex)
  const { data, isFetching, isError, error, refetch } = query

  const storeIndex = useMemo(() => {
    const map = new Map<string | null, number>()
    ;(data?.stores ?? []).forEach((s, i) => {
      if (!map.has(s)) map.set(s, i)
    })
    return (s: string | null) => map.get(s) ?? 0
  }, [data])

  const points = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        x: 0,
        label: p.day,
        value: p.price,
        color: storeColor(storeIndex(p.store)),
        meta: [
          { label: 'Магазин', value: p.store ?? 'Без магазина' },
          { label: 'Операций', value: String(p.count) },
        ],
      })),
    [data, storeIndex],
  )

  const hasInput = debounced.trim().length > 0

  return (
    <Card sx={{ p: 2.5 }}>
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            График цен товара
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Regex
            </Typography>
            <Switch
              size="small"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
              inputProps={{ 'aria-label': 'Регулярное выражение' }}
            />
          </Box>
        </Box>

        <TextField
          size="small"
          fullWidth
          placeholder="Хлеб, молоко, ^Молоко.*"
          value={name}
          onChange={(e) => setName(e.target.value)}
          helperText="Название или регулярное выражение товара. Учитывается выбранный период."
          aria-label="Название или regex товара"
        />

        {!hasInput && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
            Введите название товара, чтобы построить график цен
          </Typography>
        )}

        {hasInput && isFetching && (
          <Skeleton variant="rounded" height={220} sx={{ borderRadius: '8px' }} />
        )}

        {hasInput && !isFetching && isError && (
          <ErrorState
            message={error instanceof Error ? error.message : 'Ошибка загрузки'}
            onRetry={() => void refetch()}
          />
        )}

        {hasInput && !isFetching && !isError && data && data.count === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
            Ничего не найдено за выбранный период
          </Typography>
        )}

        {hasInput && !isFetching && !isError && data && data.count > 0 && (
          <>
            <LineChart
              points={points}
              median={data.medianPrice}
              medianLabel="медиана"
              formatValue={formatCurrency}
              valueLabel="Цена"
              zeroBased={false}
              ariaLabel="График цены товара по магазинам"
            />

            <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
              {data.stores.map((s, i) => (
                <Box key={s ?? 'null'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: storeColor(i) }} />
                  <Typography variant="caption" color="text.secondary">
                    {s ?? 'Без магазина'}
                  </Typography>
                </Box>
              ))}
            </Stack>

            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatisticCard label="Средняя цена" value={formatCurrency(data.avgPrice)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatisticCard label="Медианная цена" value={formatCurrency(data.medianPrice)} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <StatisticCard label="Станд. отклонение" value={formatCurrency(data.stddev)} hint={`${data.count} ${plural(data.count, 'покупка', 'покупки', 'покупок')}`} />
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </Card>
  )
}
