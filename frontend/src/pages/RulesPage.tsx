import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { BottomSheet } from '../components/common/BottomSheet'
import { PageHeader } from '../components/common/PageHeader'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { TagChip } from '../components/common/TagChip'
import { useRules, useCreateRule, useUpdateRule, useDeleteRule } from '../hooks/useRules'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'

/** Правила и алиасы — normalize merchant names, auto-apply tags. */
export function RulesPage() {
  const online = useOnline()
  const { data, isLoading, isError, error, refetch } = useRules()
  const { data: tags } = useTags()
  const createRule = useCreateRule()
  const updateRule = useUpdateRule()
  const deleteRule = useDeleteRule()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [pattern, setPattern] = useState('')
  const [alias, setAlias] = useState('')
  const [tagId, setTagId] = useState<string>('')
  const [formError, setFormError] = useState<string | null>(null)

  const tagById = new Map((tags ?? []).map((t) => [t.id, t]))

  const submit = async () => {
    setFormError(null)
    if (!pattern.trim() || !alias.trim()) {
      setFormError('Заполните шаблон и алиас')
      return
    }
    try {
      await createRule.mutateAsync({
        pattern: pattern.trim(),
        alias: alias.trim(),
        tagId: tagId || null,
        enabled: true,
      })
      setPattern('')
      setAlias('')
      setTagId('')
      setSheetOpen(false)
    } catch {
      setFormError('Не удалось сохранить правило')
    }
  }

  if (isLoading) return <LoadingState label="Загружаем правила…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Правила и алиасы"
        subtitle="Нормализация названий магазинов и авто-теги"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSheetOpen(true)}>
            Добавить
          </Button>
        }
      />

      {(data ?? []).length === 0 ? (
        <EmptyState
          title="Правил пока нет"
          subtitle="Создайте правило: «дикси» → «Дикси» + тег Продукты"
          actionLabel="Создать правило"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <Stack spacing={1.25} sx={{ maxWidth: 720 }}>
          {(data ?? []).map((rule) => {
            const tag = rule.tagId ? tagById.get(rule.tagId) : undefined
            return (
              <Card key={rule.id} sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5, opacity: rule.enabled ? 1 : 0.55 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Chip size="small" label={rule.pattern} variant="outlined" sx={{ fontFamily: 'monospace' }} />
                    <Typography variant="body2" color="text.secondary">→</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{rule.alias}</Typography>
                    {tag && <TagChip tag={tag} size="small" />}
                  </Box>
                </Box>
                <Switch
                  checked={rule.enabled}
                  onChange={(e) => void updateRule.mutate({ id: rule.id, patch: { enabled: e.target.checked } })}
                  inputProps={{ 'aria-label': `Правило ${rule.pattern}` }}
                  size="small"
                />
                <IconButton size="small" onClick={() => void deleteRule.mutate(rule.id)} aria-label={`Удалить правило ${rule.pattern}`} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Card>
            )
          })}
        </Stack>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Новое правило">
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Шаблон (regex)"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
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
          <FormControl fullWidth>
            <InputLabel id="rule-tag-label">Тег (необязательно)</InputLabel>
            <Select
              labelId="rule-tag-label"
              label="Тег (необязательно)"
              value={tagId}
              onChange={(e) => setTagId(e.target.value as string)}
            >
              <MenuItem value="">Без тега</MenuItem>
              {(tags ?? []).map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button variant="contained" onClick={submit} disabled={createRule.isPending} size="large">
            {createRule.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </Stack>
      </BottomSheet>
    </Stack>
  )
}
