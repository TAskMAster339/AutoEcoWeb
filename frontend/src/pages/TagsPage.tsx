import { useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
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
import { useTags, useCreateTag, useDeleteTag } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { colors } from '../theme'

const PALETTE = ['#16A34A', '#3B82F6', '#8B5CF6', '#F97316', '#06B6D4', '#F59E0B', '#EF4444', '#65A30D']

/** Теги — manage category tags. */
export function TagsPage() {
  const online = useOnline()
  const { data, isLoading, isError, error, refetch } = useTags()
  const createTag = useCreateTag()
  const deleteTag = useDeleteTag()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0] ?? '#16A34A')
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async () => {
    setFormError(null)
    if (!name.trim()) {
      setFormError('Укажите название тега')
      return
    }
    try {
      await createTag.mutateAsync({ name: name.trim(), color })
      setName('')
      setColor(PALETTE[0] ?? '#16A34A')
      setSheetOpen(false)
    } catch {
      setFormError('Не удалось сохранить тег')
    }
  }

  if (isLoading) return <LoadingState label="Загружаем теги…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Теги"
        subtitle="Категории для автоматической сортировки чеков"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setSheetOpen(true)}>
            Добавить
          </Button>
        }
      />

      {(data ?? []).length === 0 ? (
        <EmptyState
          title="Тегов пока нет"
          subtitle="Создайте тег, например «Продукты» или «Транспорт»"
          actionLabel="Создать тег"
          onAction={() => setSheetOpen(true)}
        />
      ) : (
        <Stack spacing={1.25} sx={{ maxWidth: 640 }}>
          {(data ?? []).map((tag) => (
            <Card key={tag.id} sx={{ p: 1.75, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: tag.color, flexShrink: 0 }} />
              <Typography sx={{ fontWeight: 600, flex: 1 }}>{tag.name}</Typography>
              <Chip size="small" label={`${tag.count} операций`} variant="outlined" sx={{ height: 22, fontSize: 12 }} />
              <IconButton
                size="small"
                onClick={() => void deleteTag.mutate(tag.id)}
                aria-label={`Удалить тег ${tag.name}`}
                sx={{ color: colors.textSecondary, '&:hover': { color: colors.red } }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Card>
          ))}
        </Stack>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Новый тег">
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Название"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
            placeholder="Например: Кафе"
            autoFocus
          />
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
              Цвет
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {PALETTE.map((c) => (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Цвет ${c}`}
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    bgcolor: c,
                    border: color === c ? '3px solid #111827' : '3px solid transparent',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                />
              ))}
            </Box>
          </Box>
          <Button variant="contained" onClick={submit} disabled={createTag.isPending} size="large">
            {createTag.isPending ? 'Сохраняем…' : 'Сохранить'}
          </Button>
        </Stack>
      </BottomSheet>
    </Stack>
  )
}
