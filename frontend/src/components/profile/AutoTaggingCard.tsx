import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  Stack,
  Switch,
  Typography,
} from '@mui/material'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import ExpandMoreOutlinedIcon from '@mui/icons-material/ExpandMoreOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import { messageFromError } from '../../api/client'
import type { AutoTaggingModelStatus } from '../../api/types'
import {
  useAutoTagging,
  useRetrainAutoTagging,
  useUpdateAutoTagging,
} from '../../hooks/useAutoTagging'
import { useTags } from '../../hooks/useTags'
import { colors, softBg, softFg } from '../../theme'

const STATUS_COPY: Record<AutoTaggingModelStatus, { title: string; text: string }> = {
  disabled: {
    title: 'Выключено',
    text: 'Новые операции сохраняются без автоматического выбора тега.',
  },
  insufficient_data: {
    title: 'Нужно больше примеров',
    text: 'Продолжайте назначать теги вручную — модель начнёт работать, когда сможет проверить свою точность.',
  },
  stale: {
    title: 'Есть новые данные',
    text: 'Модель обновится перед следующим предсказанием или по кнопке ниже.',
  },
  training: {
    title: 'Обновляем модель',
    text: 'Проверяем качество на последних размеченных операциях.',
  },
  ready: {
    title: 'Готово к работе',
    text: 'Тег назначается только когда проверочная точность проходит безопасный порог.',
  },
  degraded: {
    title: 'Качество ниже порога',
    text: 'Автоматические назначения приостановлены, пока не появится достаточно новых ручных примеров.',
  },
  error: {
    title: 'Не удалось обновить модель',
    text: 'Транзакции продолжат сохраняться без автоматического тега.',
  },
}

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Box sx={{ minWidth: 0, py: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography className="tnum" sx={{ fontWeight: 700, fontSize: 18, mt: 0.25 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          {hint}
        </Typography>
      )}
    </Box>
  )
}

export function AutoTaggingCard() {
  const query = useAutoTagging()
  const update = useUpdateAutoTagging()
  const retrain = useRetrainAutoTagging()
  const tagsQuery = useTags()
  const [detailsOpen, setDetailsOpen] = useState(false)
  const data = query.data
  const pending = update.isPending || retrain.isPending
  const mutationError = update.error ?? retrain.error
  const status = data?.status ?? 'disabled'
  const copy = STATUS_COPY[status]

  return (
    <Card sx={{ p: { xs: 2, md: 2.5 } }}>
      <Stack spacing={2}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
        >
          <Box
            sx={(theme) => ({
              width: 36,
              height: 36,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: softBg(theme),
              color: softFg(theme),
              flexShrink: 0,
            })}
          >
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Автотегирование</Typography>
              <Chip label="Эксперимент" size="small" color="primary" variant="outlined" />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.5, maxWidth: '72ch' }}>
              Персональная модель учится только на ваших ручных тегах. Название товара важнее магазина,
              а данные не покидают AutoEco.
            </Typography>
          </Box>
          {query.isPending ? (
            <CircularProgress size={22} aria-label="Загружаем настройку автотегирования" />
          ) : (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography component="label" htmlFor="auto-tagging-switch" sx={{ fontWeight: 700, fontSize: 14 }}>
                {data?.enabled ? 'Включено' : 'Выключено'}
              </Typography>
              <Switch
                id="auto-tagging-switch"
                checked={data?.enabled ?? false}
                onChange={(_, checked) => update.mutate(checked)}
                disabled={!data || pending}
                slotProps={{ input: { 'aria-label': 'Автоматически назначать теги' } }}
                sx={{
                  width: 48,
                  height: 30,
                  p: '4px',
                  '& .MuiSwitch-switchBase': { p: '7px' },
                  '& .MuiSwitch-thumb': { width: 16, height: 16, borderRadius: '4px' },
                  '& .MuiSwitch-track': { borderRadius: '6px' },
                }}
              />
            </Stack>
          )}
        </Stack>

        {query.isError ? (
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={() => void query.refetch()}>Повторить</Button>}
          >
            Не удалось загрузить состояние автотегирования.
          </Alert>
        ) : data ? (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 2,
                px: 1.5,
                py: 1.25,
                borderRadius: '8px',
                bgcolor: status === 'degraded' || status === 'error' ? `${colors.amber}14` : 'action.hover',
              }}
            >
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{pending ? 'Обновляем модель…' : copy.title}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.45 }}>
                  {pending ? 'Это может занять несколько секунд. Настройка сохранится после проверки качества.' : copy.text}
                </Typography>
              </Box>
              {pending && <CircularProgress size={18} />}
            </Box>

            {mutationError && <Alert severity="error">{messageFromError(mutationError)}</Alert>}

            {data.enabled && (
              <>
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' },
                    columnGap: { xs: 2, md: 3 },
                    rowGap: 0.5,
                    '& > *:not(:nth-of-type(2n+1))': { borderLeft: { xs: '1px solid', md: 'none' }, pl: { xs: 2, md: 0 } },
                    '& > *:not(:first-of-type)': { borderLeft: { md: '1px solid' }, pl: { md: 3 } },
                    borderColor: 'divider',
                  }}
                >
                  <Metric
                    label="Оценочная точность"
                    value={percent(data.precision)}
                    hint={data.validation_examples ? `${data.validation_examples} операций в проверке` : 'Пока не измерена'}
                  />
                  <Metric label="Покрытие" value={percent(data.coverage)} hint="Доля уверенных ответов" />
                  <Metric
                    label="Обучающих операций"
                    value={data.training_examples.toLocaleString('ru-RU')}
                    hint={`Минимум ${data.minimum_training_examples}`}
                  />
                  <Metric
                    label="Поддерживается тегов"
                    value={`${data.supported_tags} из ${data.distinct_tags}`}
                    hint={`От ${data.minimum_examples_per_tag} примеров на тег`}
                  />
                </Box>

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                  <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                    Только магазин: {percent(data.store_baseline_precision)} · целевая точность: {percent(data.target_precision)}
                    {data.trained_at ? ` · обновлено ${new Date(data.trained_at).toLocaleString('ru-RU')}` : ''}
                  </Typography>
                  {(status === 'stale' || status === 'error') && (
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<RefreshOutlinedIcon />}
                      onClick={() => retrain.mutate()}
                      disabled={pending}
                    >
                      Обновить модель
                    </Button>
                  )}
                  {data.per_tag_metrics.length > 0 && (
                    <Button
                      size="small"
                      color="inherit"
                      endIcon={<ExpandMoreOutlinedIcon sx={{ transform: detailsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease-out' }} />}
                      onClick={() => setDetailsOpen((value) => !value)}
                      aria-expanded={detailsOpen}
                    >
                      По тегам
                    </Button>
                  )}
                </Stack>

                <Collapse in={detailsOpen} unmountOnExit>
                  <Divider sx={{ mb: 1.5 }} />
                  <Box sx={{ display: 'grid', gap: 0 }}>
                    {data.per_tag_metrics.map((metric) => {
                      const tag = tagsQuery.data?.find((item) => item.id === metric.tag_id)
                      const tagColor = tag?.color ?? metric.tag_color
                      const tagIcon = tag?.icon ?? metric.tag_icon
                      return (
                      <Box
                        key={metric.tag_id}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                          gap: 2,
                          alignItems: 'center',
                          py: 1,
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&:last-child': { borderBottom: 0 },
                        }}
                      >
                        <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.25 }}>
                          <Box
                            aria-hidden="true"
                            sx={{
                              width: 32,
                              height: 32,
                              borderRadius: '7px',
                              bgcolor: tagColor,
                              display: 'grid',
                              placeItems: 'center',
                              flexShrink: 0,
                              fontSize: 17,
                              lineHeight: 1,
                              boxShadow: `inset 0 0 0 1px ${tagColor}`,
                            }}
                          >
                            {tagIcon ?? ''}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap title={metric.tag_name}>
                              {metric.tag_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {metric.training_examples} примеров
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="caption" className="tnum">
                          Точность {percent(metric.precision)}
                        </Typography>
                        <Chip
                          size="small"
                          label={metric.supported ? 'Активен' : 'Мало данных'}
                          color={metric.supported ? 'primary' : 'default'}
                          variant="outlined"
                        />
                      </Box>
                      )
                    })}
                  </Box>
                </Collapse>
              </>
            )}
          </>
        ) : null}
      </Stack>
    </Card>
  )
}
