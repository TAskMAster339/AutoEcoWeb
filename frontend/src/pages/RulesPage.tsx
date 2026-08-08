import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { BottomSheet } from '../components/common/BottomSheet'
import { PageHeader } from '../components/common/PageHeader'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useAliases, useCreateAlias, useDeleteAlias } from '../hooks/useAliases'
import { useOnline } from '../hooks/useOnline'

/** Алиасы — нормализация названий продавцов из чеков (реальный /api/v1/aliases). */
export function RulesPage() {
  const online = useOnline()
  const { data, isLoading, isError, error, refetch } = useAliases()
  const createAlias = useCreateAlias()
  const deleteAlias = useDeleteAlias()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [original, setOriginal] = useState('')
  const [alias, setAlias] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [priority, setPriority] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    setFormError(null)
    if (!original.trim() || !alias.trim()) {
      setFormError('Заполните шаблон и алиас')
      return
    }
    try {
      await createAlias.mutateAsync({
        original_name: original.trim(),
        alias_name: alias.trim(),
        is_regex: isRegex,
        priority: Math.min(1000, Math.max(0, Number.parseInt(priority, 10) || 0)),
      })
      setOriginal('')
      setAlias('')
      setIsRegex(false)
      setPriority('0')
      setSheetOpen(false)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось сохранить алиас')
    }
  }

  if (isLoading) return <LoadingState label="Загружаем алиасы…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Правила и алиасы"
        subtitle="Нормализация названий магазинов при импорте чеков"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSheetOpen(true)}>
            Добавить
          </Button>
        }
      />

      {(data ?? []).length === 0 ? (
        <EmptyState
          title="Алиасов пока нет"
          subtitle="Создайте правило: «перекресток» → «Перекрёсток»"
          actionLabel="Создать алиас"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <Stack spacing={1.25} sx={{ maxWidth: 720 }}>
          {(data ?? []).map((a) => (
            <Card key={a.id} sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Chip size="small" label={a.original_name} variant="outlined" sx={{ fontFamily: 'monospace' }} />
                  {a.is_regex && (
                    <Chip size="small" label="regex" variant="outlined" sx={{ height: 20, fontSize: 11, color: 'text.secondary' }} />
                  )}
                  <Typography variant="body2" color="text.secondary">→</Typography>
                  <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{a.alias_name}</Typography>
                  <Chip size="small" label={`приоритет ${a.priority}`} variant="outlined" sx={{ height: 20, fontSize: 11, color: 'text.secondary' }} />
                </Box>
              </Box>
              <IconButton size="small" onClick={() => void deleteAlias.mutate(a.id)} aria-label={`Удалить алиас ${a.original_name}`} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Card>
          ))}
        </Stack>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Новый алиас">
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Шаблон"
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            fullWidth
            placeholder="например: перекресток|перекрёсток"
            autoFocus
          />
          <TextField
            label="Алиас"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            fullWidth
            placeholder="например: Перекрёсток"
          />
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <FormControlLabel
              control={<Checkbox checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />}
              label="Регулярное выражение"
            />
            <TextField
              label="Приоритет"
              value={priority}
              onChange={(e) => setPriority(e.target.value.replace(/[^0-9]/g, ''))}
              inputMode="numeric"
              sx={{ width: 120 }}
              placeholder="0"
              slotProps={{ htmlInput: { maxLength: 4 } }}
            />
          </Stack>
          <Button variant="contained" onClick={submit} disabled={createAlias.isPending} size="large">
            {createAlias.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </Stack>
      </BottomSheet>
    </Stack>
  )
}
