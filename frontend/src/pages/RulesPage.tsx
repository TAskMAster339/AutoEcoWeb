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
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import RefreshIcon from '@mui/icons-material/Refresh'
import { BottomSheet } from '../components/common/BottomSheet'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { PageHeader } from '../components/common/PageHeader'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useAliases, useApplyAliases, useCreateAlias, useDeleteAlias, useUpdateAlias } from '../hooks/useAliases'
import { useOnline } from '../hooks/useOnline'
import type { Alias, AliasScope } from '../api/types'

const SCOPE_LABEL: Record<AliasScope, string> = {
  seller: 'магазина',
  product: 'товара',
}

/** Алиасы — нормализация названий магазинов и товаров (реальный /api/v1/aliases). */
export function RulesPage() {
  const online = useOnline()
  const [scope, setScope] = useState<AliasScope>('seller')
  const { data, isLoading, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useAliases(scope)
  const createAlias = useCreateAlias()
  const updateAlias = useUpdateAlias()
  const deleteAlias = useDeleteAlias()
  const applyAliases = useApplyAliases()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [original, setOriginal] = useState('')
  const [alias, setAlias] = useState('')
  const [isRegex, setIsRegex] = useState(false)
  const [priority, setPriority] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [editingAlias, setEditingAlias] = useState<Alias | null>(null)

  const items = data?.pages.flatMap((p) => p.items) ?? []
  const total = data?.pages[0]?.total ?? 0

  const closeSheet = () => {
    setSheetOpen(false)
    setFormError(null)
    setEditingAlias(null)
  }

  const openCreate = () => {
    setEditingAlias(null)
    setOriginal('')
    setAlias('')
    setIsRegex(false)
    setPriority('0')
    setFormError(null)
    setSheetOpen(true)
  }

  const openEdit = (item: Alias) => {
    setEditingAlias(item)
    setOriginal(item.original_name)
    setAlias(item.alias_name)
    setIsRegex(item.is_regex)
    setPriority(String(item.priority))
    setFormError(null)
    setSheetOpen(true)
  }

  const submit = async () => {
    setFormError(null)
    if (!original.trim() || !alias.trim()) {
      setFormError('Заполните шаблон и алиас')
      return
    }
    try {
      const draft = {
        original_name: original.trim(),
        alias_name: alias.trim(),
        scope,
        is_regex: isRegex,
        priority: Math.min(1000, Math.max(0, Number.parseInt(priority, 10) || 0)),
      }
      if (editingAlias) {
        await updateAlias.mutateAsync({ id: editingAlias.id, patch: draft })
      } else {
        await createAlias.mutateAsync(draft)
      }
      setOriginal('')
      setAlias('')
      setIsRegex(false)
      setPriority('0')
      closeSheet()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Не удалось сохранить алиас')
    }
  }

  const runApplyAll = async () => {
    setConfirmOpen(false)
    try {
      await applyAliases.mutateAsync(undefined)
    } catch {
      // ошибка показывается в Alert под заголовком (applyAliases.error)
    }
  }

  const applyTotal =
    applyAliases.data == null
      ? 0
      : applyAliases.data.seller_updated_receipts +
        applyAliases.data.seller_updated_transactions +
        applyAliases.data.product_updated

  if (isLoading) return <LoadingState label="Загружаем алиасы…" />
  if (!online) return <OfflineState onRetry={() => void refetch()} />
  if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

  return (
    <Stack spacing={2}>
      <PageHeader
        title="Правила"
        subtitle="Нормализация названий магазинов и товаров: новый алиас сразу применяется к существующим записям"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Добавить
          </Button>
        }
      />

      <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Tabs
          value={scope}
          onChange={(_, v: AliasScope) => setScope(v)}
          aria-label="Тип алиасов"
          sx={{
            minHeight: 40,
            '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600, px: 2 },
          }}
        >
          <Tab value="seller" label={`Магазины${total > 0 && scope === 'seller' ? ` (${total})` : ''}`} />
          <Tab value="product" label={`Товары${total > 0 && scope === 'product' ? ` (${total})` : ''}`} />
        </Tabs>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={() => setConfirmOpen(true)}
          disabled={applyAliases.isPending}
        >
          {applyAliases.isPending ? 'Применяем…' : 'Применить все алиасы'}
        </Button>
      </Stack>

      {applyAliases.isError && (
        <Alert severity="error" sx={{ borderRadius: '8px' }}>
          {applyAliases.error instanceof Error ? applyAliases.error.message : 'Не удалось применить алиасы'}
        </Alert>
      )}
      {applyAliases.isSuccess && applyTotal > 0 && (
        <Alert severity="success" sx={{ borderRadius: '8px' }}>
          Обновлено записей: {applyTotal} (магазины: {applyAliases.data!.seller_updated_receipts} чеков +{' '}
          {applyAliases.data!.seller_updated_transactions} транзакций, товары: {applyAliases.data!.product_updated})
        </Alert>
      )}
      {applyAliases.isSuccess && applyTotal === 0 && (
        <Alert severity="info" sx={{ borderRadius: '8px' }}>
          Все записи уже соответствуют алиасам — ничего не изменено
        </Alert>
      )}
      {createAlias.isSuccess && !sheetOpen && (
        <Alert severity="success" sx={{ borderRadius: '8px' }}>
          Алиас создан и применён к подходящим записям
        </Alert>
      )}

      {items.length === 0 ? (
        <EmptyState
          title={scope === 'seller' ? 'Алиасов магазинов пока нет' : 'Алиасов товаров пока нет'}
          subtitle={
            scope === 'seller'
              ? 'Создайте правило: «перекресток» → «Перекрёсток»'
              : 'Создайте правило: «РАЭ Сырок тв.гл.с вар.сг.15%45г» → «Глазированный сырок»'
          }
          actionLabel="Создать алиас"
          onAction={openCreate}
        />
      ) : (
        <Stack spacing={1.25} sx={{ maxWidth: 720 }}>
          {items.map((a) => (
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
              <IconButton size="small" onClick={() => openEdit(a)} aria-label={`Редактировать алиас ${a.original_name}`} sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}>
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" onClick={() => void deleteAlias.mutate(a.id)} aria-label={`Удалить алиас ${a.original_name}`} sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Card>
          ))}
          {hasNextPage && (
            <Button
              variant="text"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              sx={{ alignSelf: 'center', textTransform: 'none', fontWeight: 600 }}
            >
              {isFetchingNextPage ? 'Загружаем…' : 'Загрузить ещё'}
            </Button>
          )}
        </Stack>
      )}

      <BottomSheet
        open={sheetOpen}
        onClose={closeSheet}
        title={editingAlias ? `Редактировать алиас ${SCOPE_LABEL[scope]}` : `Новый алиас ${SCOPE_LABEL[scope]}`}
      >
        <Stack spacing={2}>
          {formError && <Alert severity="error">{formError}</Alert>}
          <TextField
            label="Шаблон"
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            fullWidth
            placeholder={
              scope === 'seller'
                ? 'например: перекресток|перекрёсток'
                : 'например: РАЭ Сырок тв.гл.с вар.сг.15%45г'
            }
            autoFocus
          />
          <TextField
            label="Алиас"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            fullWidth
            placeholder={scope === 'seller' ? 'например: Перекрёсток' : 'например: Глазированный сырок'}
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
          <Button variant="contained" onClick={submit} disabled={createAlias.isPending || updateAlias.isPending} size="large">
            {createAlias.isPending || updateAlias.isPending ? 'Сохраняем…' : editingAlias ? 'Сохранить изменения' : 'Сохранить'}
          </Button>
        </Stack>
      </BottomSheet>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void runApplyAll()}
        tone="primary"
        title="Применить все алиасы?"
        message="Все алиасы магазинов и товаров будут применены к существующим чекам и транзакциям. Операция переименовывает подходящие записи и необратима."
        confirmLabel="Применить"
        pending={applyAliases.isPending}
        error={applyAliases.isError ? (applyAliases.error instanceof Error ? applyAliases.error.message : null) : null}
      />
    </Stack>
  )
}
