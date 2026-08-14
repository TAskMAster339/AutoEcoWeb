import { memo, useCallback, useEffect, useMemo } from 'react'
import { Box, Button, Card, Grid2 as Grid, Skeleton, Stack, Switch, TextField, Typography } from '@mui/material'
import { EmptyChart, LineChart, storeColor } from './Charts'
import { StatisticCard } from '../common/StatisticCard'
import { ErrorState } from '../common/States'
import { usePriceChart } from '../../hooks/useSummary'
import { formatCurrency, plural } from '../../lib/format'
import { useUiStore } from '../../store/uiStore'
import { RegexBuilder } from '../common/RegexBuilder'
import type { PriceChartData } from '../../api/types'

const DEBOUNCE_MS = 400

interface PriceChartResultsProps {
  data: PriceChartData | undefined
  hasInput: boolean
  isFetching: boolean
  isError: boolean
  error: unknown
  onRetry: () => void
}

const PriceChartResults = memo(function PriceChartResults({ data, hasInput, isFetching, isError, error, onRetry }: PriceChartResultsProps) {
  const storeIndex = useMemo(() => {
    const map = new Map<string | null, number>()
    ;(data?.stores ?? []).forEach((store, index) => {
      if (!map.has(store)) map.set(store, index)
    })
    return (store: string | null) => map.get(store) ?? 0
  }, [data])
  const points = useMemo(() => (data?.points ?? []).map((point) => {
    const names = point.names ?? []
    return {
      x: 0,
      label: point.day,
      value: point.price,
      color: storeColor(storeIndex(point.store)),
      meta: [
        { label: 'Магазин', value: point.store ?? 'Без магазина' },
        { label: 'Операций', value: String(point.count) },
        ...(names.length ? [{ label: names.length === 1 ? 'Транзакция' : 'Транзакции', value: names.join(', ') }] : []),
      ],
    }
  }), [data, storeIndex])
  const hasData = Boolean(data && data.count > 0)
  const statValue = (value: number) => (hasData ? formatCurrency(value) : '—')

  return <>
    {!hasInput ? (
      <EmptyChart text="Введите название товара — например, *биойогурт*" ariaLabel="График цен ожидает ввода" />
    ) : isFetching ? (
      <Skeleton variant="rounded" height={180} sx={{ borderRadius: '8px' }} />
    ) : isError ? (
      <ErrorState message={error instanceof Error ? error.message : 'Ошибка загрузки'} onRetry={onRetry} />
    ) : data && data.count === 0 ? (
      <EmptyChart text="Ничего не найдено за выбранный период" ariaLabel="График цен пуст" />
    ) : data ? <>
      <LineChart points={points} median={data.medianPrice} medianLabel="медиана" formatValue={formatCurrency} valueLabel="Цена" zeroBased={false} ariaLabel="График цены товара по магазинам" />
      <Stack direction="row" spacing={1.25} sx={{ flexWrap: 'wrap' }}>
        {data.stores.map((store, index) => <Box key={store ?? 'null'} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '3px', bgcolor: storeColor(index) }} />
          <Typography variant="caption" color="text.secondary">{store ?? 'Без магазина'}</Typography>
        </Box>)}
      </Stack>
    </> : null}
    <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mt: 0.5 }}>
      <Grid size={{ xs: 12, sm: 4 }}><StatisticCard label="Средняя цена" value={statValue(data?.avgPrice ?? 0)} /></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><StatisticCard label="Медианная цена" value={statValue(data?.medianPrice ?? 0)} /></Grid>
      <Grid size={{ xs: 12, sm: 4 }}><StatisticCard label="Станд. отклонение" value={statValue(data?.stddev ?? 0)} hint={hasData && data ? `${data.count} ${plural(data.count, 'покупка', 'покупки', 'покупок')}` : undefined} /></Grid>
    </Grid>
  </>
})

/** График цен товара (название или regex) — точки по магазинам, медиана, статистика. */
export function PriceChartCard() {
  const name = useUiStore((state) => state.priceChartName)
  const isRegex = useUiStore((state) => state.priceChartIsRegex)
  const submittedName = useUiStore((state) => state.priceChartSubmittedName)
  const submittedIsRegex = useUiStore((state) => state.priceChartSubmittedIsRegex)
  const setName = useUiStore((state) => state.setPriceChartName)
  const setIsRegex = useUiStore((state) => state.setPriceChartIsRegex)
  const submitPriceChart = useUiStore((state) => state.submitPriceChart)

  useEffect(() => {
    if (isRegex) return
    const t = window.setTimeout(() => {
      submitPriceChart(name, false)
    }, DEBOUNCE_MS)
    return () => window.clearTimeout(t)
  }, [isRegex, name, submitPriceChart])

  const query = usePriceChart(submittedName, submittedIsRegex)
  const { data, isFetching, isError, error, refetch } = query
  const retry = useCallback(() => { void refetch() }, [refetch])

  const hasInput = submittedName.trim().length > 0
  const regexChanged = isRegex && (name.trim() !== submittedName || !submittedIsRegex)
  const submitSearch = useCallback(() => {
    if (!name.trim() || isFetching) return
    if (isRegex && !regexChanged) return
    submitPriceChart(name, isRegex)
  }, [isFetching, isRegex, name, regexChanged, submitPriceChart])

  return (
    <Card sx={{ p: { xs: 1.5, sm: 2.5 } }}>
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            График цен товара
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">
              Расширенный шаблон
            </Typography>
            <Switch
              size="small"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
              inputProps={{ 'aria-label': 'Использовать расширенный шаблон' }}
            />
          </Box>
        </Box>

        <Box
          component="form"
          onSubmit={(event) => {
            event.preventDefault()
            submitSearch()
          }}
        >
          {isRegex ? (
            <Stack spacing={1.25}>
              <RegexBuilder value={name} onChange={setName} scope="product" />
              <Button type="submit" variant="contained" fullWidth disabled={!name.trim() || !regexChanged || isFetching}>
                {isFetching ? 'Ищем…' : 'Показать график'}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
                Нажмите Enter или кнопку — запрос не запускается во время ввода.
              </Typography>
            </Stack>
          ) : (
            <TextField
              size="small"
              fullWidth
              placeholder="Хлеб или молоко"
              value={name}
              onChange={(e) => setName(e.target.value)}
              helperText="Введите часть названия и нажмите Enter. Учитывается выбранный период."
              aria-label="Название товара"
            />
          )}
        </Box>

        <PriceChartResults data={data} hasInput={hasInput} isFetching={isFetching} isError={isError} error={error} onRetry={retry} />
      </Stack>
    </Card>
  )
}
