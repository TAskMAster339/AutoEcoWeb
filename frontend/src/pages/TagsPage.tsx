import { useMemo, useState } from 'react'
import type { ChangeEvent, KeyboardEvent } from 'react'

import {
  Alert,
  Box,
  Button,
  Card,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckIcon from '@mui/icons-material/Check'

import { BottomSheet } from '../components/common/BottomSheet'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useInfiniteTags, useCreateTag, useDeleteTag, useUpdateTag } from '../hooks/useTags'
import { useTransactions } from '../hooks/useTransactions'
import { useOnline } from '../hooks/useOnline'
import { PageSearch } from '../components/common/PageSearch'
import { useNavigate } from 'react-router-dom'
import type { Tag } from '../api/types'

const PALETTE = ['#16A34A', '#3B82F6', '#8B5CF6', '#F97316', '#06B6D4', '#F59E0B', '#EF4444', '#65A30D']

/** Теги — manage category tags (реальный API; счётчики — из чеков). */
export function TagsPage() {
  const online = useOnline()
  const navigate = useNavigate()
  const infiniteTags = useInfiniteTags()
  const { data: transactions } = useTransactions()

  const createTag = useCreateTag()
  const deleteTag = useDeleteTag()
  const updateTag = useUpdateTag()

  // счётчик операций по тегу — из транзакций (бэкенд его не отдаёт)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const tx of transactions ?? []) {
      if (tx.tag_id) m.set(tx.tag_id, (m.get(tx.tag_id) ?? 0) + 1)
    }
    return m
  }, [transactions])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(PALETTE[0] ?? '#16A34A')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingTag, setEditingTag] = useState<Tag | null>(null)

  const openCreate = () => {
    setEditingTag(null)
    setName('')
    setColor(PALETTE[0] ?? '#16A34A')
    setFormError(null)
    setSheetOpen(true)
  }

  const openEdit = (tag: Tag) => {
    setEditingTag(tag)
    setName(tag.name)
    setColor(tag.color)
    setFormError(null)
    setSheetOpen(true)
  }

  const submit = async () => {
    setFormError(null)
    if (!name.trim()) {
      setFormError('Укажите название тега')
      return
    }
    if (!/^#[0-9A-F]{6}$/.test(color)) {
      setFormError('Укажите корректный цвет в формате HEX')
      return
    }
    try {
      if (editingTag) {
        await updateTag.mutateAsync({ id: editingTag.id, patch: { name: name.trim(), color } })
      } else {
        await createTag.mutateAsync({ name: name.trim(), color })
      }
      setName('')
      setColor(PALETTE[0] ?? '#16A34A')
      setEditingTag(null)
      setSheetOpen(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Не удалось сохранить тег')
    }
  }

  const tags = infiniteTags.data?.pages.flatMap((page) => page.items) ?? []
  const [search, setSearch] = useState('')
  const visibleTags = tags.filter((tag) => tag.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))
  const isLoading = infiniteTags.isLoading
  const isError = infiniteTags.isError
  const error = infiniteTags.error
  const refetch = infiniteTags.refetch
  const handleEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (event.key === 'Enter') void submit()
    else {
      setSheetOpen(false)
      setEditingTag(null)
      setFormError(null)
    }
  }

  if (isLoading) return <LoadingState label="Загружаем теги…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <PageSearch value={search} onChange={setSearch} placeholder="Поиск по имени тега" ariaLabel="Поиск по имени тега" width="100%" />
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ flexShrink: 0 }}>
          Добавить
        </Button>
      </Stack>

      {visibleTags.length === 0 ? (
        <EmptyState
          title="Тегов пока нет"
          subtitle="Создайте тег, например «Продукты» или «Транспорт»"
          actionLabel="Создать тег"
          onAction={openCreate}
        />
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 1.5,
            width: '100%',
          }}
        >
          {visibleTags.map((tag) => (
            <Card key={tag.id} sx={{ aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box
                component="button"
                type="button"
                onClick={() => navigate(`/transactions?tag=${encodeURIComponent(tag.id)}`)}
                title={`Открыть таблицу с тегом «${tag.name}»`}
                aria-label={`Открыть таблицу с фильтром по тегу ${tag.name}`}
                sx={{ flex: 1, minHeight: 0, border: 0, p: 0, bgcolor: tag.color, cursor: 'pointer' }}
              />
              <Box sx={{ bgcolor: 'background.paper', p: 1.5 }}>
                <Typography sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.name}</Typography>
                <Typography variant="caption" color="text.secondary">{counts.get(tag.id) ?? 0} операций</Typography>
                <Stack direction="row" spacing={0.75} sx={{ mt: 1.25, justifyContent: 'space-between' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => openEdit(tag)}
                    aria-label={`Изменить тег ${tag.name}`}
                    sx={{ borderRadius: '6px', textTransform: 'none', px: 1.25, py: 0.5, minWidth: 0 }}
                  >
                    Изменить
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => void deleteTag.mutate(tag.id)}
                    aria-label={`Удалить тег ${tag.name}`}
                    sx={{ borderRadius: '6px', textTransform: 'none', px: 1.25, py: 0.5, minWidth: 0 }}
                  >
                    Удалить
                  </Button>
                </Stack>
              </Box>
            </Card>
          ))}
          {infiniteTags.hasNextPage && (
            <Box
              ref={(node: HTMLDivElement | null) => {
                if (!node || infiniteTags.isFetchingNextPage) return
                const observer = new IntersectionObserver((entries) => {
                  if (entries[0]?.isIntersecting) void infiniteTags.fetchNextPage()
                }, { rootMargin: '240px' })
                observer.observe(node)
                return () => observer.disconnect()
              }}
              sx={{ height: 1 }}
            />
          )}
        </Box>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
          setEditingTag(null)
          setFormError(null)
        }}
        title={editingTag ? 'Редактировать тег' : 'Новый тег'}
      >
        <Stack spacing={2} onKeyDown={handleEditorKeyDown}>
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
            <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.75 }}>
              Дефолтные цвета
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1 }}>
              {PALETTE.map((c) => (
                <Box
                  key={c}
                  component="button"
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Выбрать цвет ${c}`}
                  aria-pressed={color === c}
                  sx={{
                    position: 'relative',
                    height: 40,
                    borderRadius: '8px',
                    bgcolor: c,
                    border: color === c ? '3px solid' : '1px solid transparent',
                    borderColor: color === c ? 'text.primary' : 'transparent',
                    boxShadow: color === c ? '0 0 0 2px background.paper' : 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  {color === c && <CheckIcon sx={{ color: '#fff', fontSize: 20 }} />}
                </Box>
              ))}
            </Box>

            <Typography sx={{ fontSize: 13, fontWeight: 700, mt: 2, mb: 0.75 }}>
              Свой цвет
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
              <Box
                component="input"
                type="color"
                value={color}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setColor(e.target.value.toUpperCase())}
                aria-label="Выбрать свой цвет"
                sx={{ width: 44, height: 36, p: 0.25, border: '1px solid', borderColor: 'divider', borderRadius: '6px', bgcolor: 'transparent', cursor: 'pointer' }}
              />
              <TextField
                label="Свой цвет"
                value={color}
                onChange={(e) => setColor(e.target.value.toUpperCase())}
                inputProps={{ maxLength: 7, inputMode: 'text' }}
                error={color !== '' && !/^#[0-9A-F]{6}$/.test(color)}
                helperText="HEX, например #6C5CE7"
                size="small"
              />
            </Stack>
          </Box>
          <Button variant="contained" onClick={submit} disabled={createTag.isPending || updateTag.isPending} size="large">
            {createTag.isPending || updateTag.isPending ? 'Сохраняем…' : editingTag ? 'Сохранить изменения' : 'Сохранить'}
          </Button>
        </Stack>
      </BottomSheet>
    </Stack>
  )
}
