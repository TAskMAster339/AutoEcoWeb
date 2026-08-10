import { useEffect, useId, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  IconButton,
  Tooltip,
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddLinkOutlinedIcon from '@mui/icons-material/AddLinkOutlined'
import { NumericField } from '../common/NumericField'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { useTags } from '../../hooks/useTags'
import { useDeleteTransaction, useStores, useUpdateTransaction } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { todayIso } from '../../lib/format'
import { parseNum } from '../../lib/numbers'
import { colors } from '../../theme'
import type { Store, TransactionUpdatePatch, TransactionView } from '../../api/types'
import { CreateAliasDialog } from '../common/CreateAliasDialog'

interface EditTransactionDialogProps {
  /** Транзакция для редактирования; null — диалог закрыт. */
  tx: TransactionView | null
  onClose: () => void
}

/**
 * Модальное окно изменения транзакции: форма (тип, название, магазин,
 * дата, цена × кол-во = сумма, тег) + кнопка «Удалить» с подтверждением.
 * PATCH /api/v1/transactions/{id} — применяются только изменённые поля.
 */
export function EditTransactionDialog({ tx, onClose }: EditTransactionDialogProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const titleId = useId()

  const { data: tags } = useTags()
  const { data: stores } = useStores()
  const updateTx = useUpdateTransaction()
  const deleteTx = useDeleteTransaction()

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [date, setDate] = useState(todayIso())
  const [name, setName] = useState('')
  const [store, setStore] = useState('')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [storeEdited, setStoreEdited] = useState(false)
  const [comment, setComment] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [tagSearch, setTagSearch] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [aliasScope, setAliasScope] = useState<'seller' | 'product' | null>(null)

  const open = tx !== null

  // Заполняем форму при открытии/смене транзакции
  useEffect(() => {
    if (!tx) return
    const amount = tx.income ?? tx.expense ?? null
    setType(tx.income !== null && tx.income !== undefined ? 'income' : 'expense')
    setDate(tx.date || todayIso())
    setName(tx.name)
    const matchingStore = (stores ?? []).find((candidate) => {
      const label = candidate.alias_name || candidate.normalized_seller_name || candidate.seller_name
      return candidate.seller_id === tx.sellerId || (tx.sellerId === null && label === tx.store)
    }) ?? null
    setSelectedStore(matchingStore)
    setStore(matchingStore ? (matchingStore.alias_name || matchingStore.normalized_seller_name || matchingStore.seller_name) : tx.store ?? '')
    setStoreEdited(false)
    setComment(tx.comment ?? '')
    setPrice(tx.price !== null && tx.price !== undefined ? String(tx.price) : amount !== null ? String(amount) : '')
    setQuantity(tx.quantity !== null && tx.quantity !== undefined ? String(tx.quantity) : '1')
    setSelectedTag(tx.tagId)
    setTagSearch('')
    setFormError(null)
    setConfirmOpen(false)
  }, [stores, tx])

  // Блокируем скролл приложения (скроллится только <main>)
  useEffect(() => {
    if (!open) return
    const main = document.querySelector('main')
    if (!main) return
    const prev = main.style.overflowY
    main.style.overflowY = 'hidden'
    return () => {
      main.style.overflowY = prev
    }
  }, [open])

  const priceNum = price ? parseNum(price) : NaN
  const qtyNum = quantity ? parseNum(quantity) : NaN
  const computedAmount =
    Number.isFinite(priceNum) && Number.isFinite(qtyNum)
      ? Math.round(priceNum * qtyNum * 100) / 100
      : null
  const amountText = computedAmount !== null ? computedAmount.toFixed(2).replace('.', ',') : ''

  if (!tx) return null

  const submit = async () => {
    setFormError(null)

    if (!name.trim()) {
      setFormError('Укажите название транзакции')
      return
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setFormError('Укажите цену больше нуля')
      return
    }
    if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
      setFormError('Количество должно быть больше нуля')
      return
    }

    const patch: TransactionUpdatePatch = {}
    const newName = name.trim()
    const newStore = selectedStore ? selectedStore.seller_name : store.trim() || null
    const newType = type === 'income' ? 2 : 1
    if (newName !== tx.name) patch.name = newName
    const currentStore = tx.sellerNameSource ?? null
    if (storeEdited && newStore !== currentStore) patch.seller_name = newStore
    if (newType !== (tx.income !== null && tx.income !== undefined ? 2 : 1)) patch.operation_type = newType
    const newDate = `${date}T12:00:00Z`
    const oldDate = `${tx.date}T12:00:00Z`
    if (newDate !== oldDate) patch.datetime = newDate
    // цена/кол-во меняют сумму — отправляем все три только если что-то изменилось
    const oldQty = tx.quantity !== null && tx.quantity !== undefined ? Number(tx.quantity) : 1
    const oldPrice = tx.price !== null && tx.price !== undefined ? Number(tx.price) : tx.income ?? tx.expense ?? computedAmount
    if (qtyNum !== oldQty || priceNum !== oldPrice) {
      patch.price = priceNum
      patch.quantity = qtyNum
      patch.amount = computedAmount!
    } else if (computedAmount !== null && computedAmount !== (tx.income ?? tx.expense)) {
      // сумма могла измениться без изменения цены/кол-ва (несоответствие в данных)
      patch.amount = computedAmount
    }
    if (selectedTag !== tx.tagId) patch.tag_id = selectedTag
    const newComment = comment.trim() || null
    if (newComment !== tx.comment) patch.comment = newComment

    try {
      await updateTx.mutateAsync({ id: tx.id, patch })
      onClose()
    } catch (e) {
      setFormError(messageFromError(e))
    }
  }

  const handleDelete = async () => {
    setFormError(null)
    try {
      await deleteTx.mutateAsync(tx.id)
      setConfirmOpen(false)
      onClose()
    } catch (e) {
      setFormError(messageFromError(e))
      setConfirmOpen(false)
    }
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={updateTx.isPending || deleteTx.isPending ? undefined : onClose}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            if (!updateTx.isPending && !deleteTx.isPending) {
              event.preventDefault()
              event.stopPropagation()
              onClose()
            }
            return
          }
          if (
            event.key === 'Enter' &&
            !event.shiftKey &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey &&
            !updateTx.isPending &&
            !deleteTx.isPending &&
            !confirmOpen &&
            !aliasScope &&
            !(event.target instanceof HTMLTextAreaElement)
          ) {
            event.preventDefault()
            event.stopPropagation()
            void submit()
          }
        }}
        fullWidth
        maxWidth="sm"
        aria-labelledby={titleId}
        slotProps={{
          backdrop: {
            sx: {
              backgroundColor: 'rgba(12, 12, 16, 0.62)',
              backdropFilter: 'blur(2px)',
            },
          },
          paper: { sx: { borderRadius: '10px', p: { xs: 1.5, sm: 2 } } },
        }}
      >
        <DialogContent sx={{ p: 0, pb: 1.5 }}>
          <Typography id={titleId} sx={{ fontSize: 17, fontWeight: 700, mb: 2 }}>
            Изменить транзакцию
          </Typography>

          {formError && (
            <Alert severity="error" sx={{ mb: 1.5, borderRadius: '8px' }}>
              {formError}
            </Alert>
          )}

          <Stack spacing={2}>
            <ToggleButtonGroup
              value={type}
              exclusive
              onChange={(_, v) => v && setType(v)}
              size="small"
              fullWidth
              aria-label="Тип операции"
            >
              <ToggleButton value="expense" sx={{ flex: 1, color: colors.red }}>
                Расход
              </ToggleButton>
              <ToggleButton value="income" sx={{ flex: 1, color: colors.green }}>
                Доход
              </ToggleButton>
            </ToggleButtonGroup>

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label="Название"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                autoFocus
                placeholder="Например: Кофе, проезд, зарплата"
                helperText={tx.nameAliasName ? `Алиас: оригинал «${tx.nameSource}»` : ' '}
              />
              <Tooltip title="Создать алиас названия">
                <span>
                  <IconButton
                    aria-label="Создать алиас названия"
                    color="primary"
                    onClick={() => setAliasScope('product')}
                    disabled={!name.trim()}
                    sx={{ width: 56, height: 56, mt: 0, borderRadius: '6px', border: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}
                  >
                    <AddLinkOutlinedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Box sx={{ flex: 1, minWidth: 0 }}>
              <Autocomplete
                freeSolo
                options={stores ?? []}
                value={selectedStore}
                inputValue={store}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    // Let Autocomplete select the highlighted option; the
                    // dialog must not treat this as a form submission.
                    event.stopPropagation()
                  }
                }}
                onChange={(_, value) => {
                  if (typeof value === 'string') {
                    setSelectedStore(null)
                    setStore(value)
                    setStoreEdited(true)
                  } else {
                    setSelectedStore(value)
                    setStore(value ? value.alias_name || value.normalized_seller_name || value.seller_name : '')
                    setStoreEdited(true)
                  }
                }}
                onInputChange={(_, value, reason) => {
                  if (reason === 'input') {
                    setSelectedStore(null)
                    setStore(value)
                    setStoreEdited(true)
                  }
                }}
                getOptionLabel={(option) => typeof option === 'string' ? option : option.alias_name || option.normalized_seller_name || option.seller_name}
                isOptionEqualToValue={(option, value) => option.seller_id === value.seller_id}
                renderOption={(props, option) => (
                  <li {...props} key={option.seller_id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{option.alias_name || option.normalized_seller_name || option.seller_name}</span>
                      {option.alias_name && <Chip label="алиас" size="small" color="primary" />}
                    </Stack>
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Магазин (необязательно)"
                    placeholder="Выберите или введите новый"
                    helperText={selectedStore?.alias_name ? `Алиас: оригинал «${selectedStore.seller_name}»` : 'Можно выбрать существующий или ввести новый'}
                    slotProps={{
                      input: {
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {selectedStore?.alias_name && <Chip label="алиас" size="small" color="primary" sx={{ mr: 0.5 }} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      },
                    }}
                  />
                )}
              />
              <Typography variant="caption" color="text.secondary">
                «Без магазина» — очистите поле. Новое имя создаст отдельный магазин.
              </Typography>
              </Box>
              <Tooltip title="Создать алиас магазина">
                <span>
                  <IconButton
                    aria-label="Создать алиас магазина"
                    color="primary"
                    onClick={() => setAliasScope('seller')}
                    disabled={!store.trim()}
                    sx={{ width: 56, height: 56, mt: 0, borderRadius: '6px', border: `1px solid ${theme.palette.divider}`, flexShrink: 0 }}
                  >
                    <AddLinkOutlinedIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>

            <TextField
              label="Комментарий (необязательно)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              placeholder="Заметка к транзакции"
            />

            <Stack direction="row" spacing={1.5}>
              <NumericField
                label="Цена, ₽"
                value={price}
                onChange={setPrice}
                required
                min={0.01}
                step={1}
                placeholder="139,90"
                error={price !== '' && (!Number.isFinite(priceNum) || priceNum <= 0)}
                helperText={price !== '' && (!Number.isFinite(priceNum) || priceNum <= 0) ? 'Цена должна быть больше 0' : ' '}
              />
              <NumericField
                label="Кол-во"
                value={quantity}
                onChange={setQuantity}
                min={1}
                step={1}
                placeholder="1"
                error={quantity !== '' && (!Number.isFinite(qtyNum) || qtyNum <= 0)}
                helperText={quantity !== '' && (!Number.isFinite(qtyNum) || qtyNum <= 0) ? 'Кол-во должно быть больше 0' : ' '}
              />
            </Stack>

            <Stack direction="row" spacing={1.5}>
              <TextField label="Дата" type="date" value={date} onChange={(e) => setDate(e.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
              <TextField
                label="Сумма, ₽"
                value={amountText}
                fullWidth
                slotProps={{ input: { readOnly: true } }}
                placeholder="—"
                helperText="Считается автоматически"
              />
            </Stack>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                Тег
              </Typography>
              <TextField
                value={tagSearch}
                onChange={(event) => setTagSearch(event.target.value)}
                placeholder="Найти тег по названию"
                size="small"
                fullWidth
                sx={{ mb: 1 }}
                inputProps={{ 'aria-label': 'Поиск тега по названию' }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {tagSearch.trim() ? 'Результаты поиска' : 'Недавние теги'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', minHeight: 34 }}>
                {(tags ?? [])
                  .filter((tag) => !tagSearch.trim() || tag.name.toLocaleLowerCase().includes(tagSearch.trim().toLocaleLowerCase()))
                  .slice(0, tagSearch.trim() ? undefined : 8)
                  .map((tag) => (
                    <Chip
                      key={tag.id}
                      label={tag.name}
                      clickable
                      onClick={() => setSelectedTag((prev) => (prev === tag.id ? null : tag.id))}
                      sx={{
                        bgcolor: `${tag.color}1A`,
                        color: theme.palette.text.primary,
                        border: `1px solid ${tag.color}66`,
                        borderRadius: '6px',
                        '&:hover': { bgcolor: `${tag.color}33` },
                        ...(selectedTag === tag.id && {
                          bgcolor: `${tag.color}40`,
                          borderColor: tag.color,
                          boxShadow: `0 0 0 1px ${tag.color}`,
                        }),
                        '& .MuiChip-label': { px: 1.25 },
                      }}
                    />
                  ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 0, pb: 0.5, justifyContent: 'space-between', gap: 1 }}>
          <Button
            variant="text"
            color="error"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => setConfirmOpen(true)}
            disabled={deleteTx.isPending}
            sx={{
              borderRadius: '8px',
              color: colors.red,
              '&:hover': { bgcolor: alpha(colors.red, theme.palette.mode === 'dark' ? 0.15 : 0.08) },
            }}
          >
            Удалить
          </Button>
          <Stack direction="row" spacing={1} sx={{ flex: 1, justifyContent: 'flex-end' }}>
            <Button variant="text" onClick={onClose} disabled={updateTx.isPending || deleteTx.isPending} sx={{ borderRadius: '8px' }}>
              Отмена
            </Button>
            <Button
              variant="contained"
              onClick={() => void submit()}
              disabled={updateTx.isPending || deleteTx.isPending}
              size={isMobile ? 'medium' : 'small'}
              sx={{ borderRadius: '8px', minWidth: 110 }}
            >
              {updateTx.isPending ? <CircularProgress size={20} color="inherit" /> : 'Сохранить'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        title="Удалить транзакцию?"
        message={`«${tx.name}» будет удалена безвозвратно.`}
        confirmLabel="Удалить"
        pending={deleteTx.isPending}
        error={formError}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmOpen(false)}
      />
      {aliasScope && (
        <CreateAliasDialog
          open
          scope={aliasScope}
          originalName={aliasScope === 'seller' ? store : name}
          onClose={() => setAliasScope(null)}
        />
      )}
    </>
  )
}
