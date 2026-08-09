import { useEffect, useId, useState } from 'react'
import {
  Alert,
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
  useMediaQuery,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { NumericField, parseNum } from '../common/NumericField'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { useTags } from '../../hooks/useTags'
import { useDeleteTransaction, useUpdateTransaction } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { todayIso } from '../../lib/format'
import { colors } from '../../theme'
import type { TransactionUpdatePatch, TransactionView } from '../../api/types'
import { AliasShortcut, CreateAliasDialog } from '../common/CreateAliasDialog'

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
  const updateTx = useUpdateTransaction()
  const deleteTx = useDeleteTransaction()

  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [date, setDate] = useState(todayIso())
  const [name, setName] = useState('')
  const [store, setStore] = useState('')
  const [comment, setComment] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
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
    setStore(tx.store ?? '')
    setComment(tx.comment ?? '')
    setPrice(tx.price !== null && tx.price !== undefined ? String(tx.price) : amount !== null ? String(amount) : '')
    setQuantity(tx.quantity !== null && tx.quantity !== undefined ? String(tx.quantity) : '1')
    setSelectedTag(tx.tagId)
    setFormError(null)
    setConfirmOpen(false)
  }, [tx])

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
    const newStore = store.trim() || null
    const newType = type === 'income' ? 2 : 1
    if (newName !== tx.name) patch.name = newName
    if (newStore !== tx.store) patch.seller_name = newStore
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

            <TextField
              label="Название"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              autoFocus
              placeholder="Например: Кофе, проезд, зарплата"
              slotProps={{
                input: {
                  endAdornment: (
                    <AliasShortcut
                      scope="product"
                      originalName={name}
                      onClick={() => setAliasScope('product')}
                    />
                  ),
                },
              }}
            />

            <TextField
              label="Магазин (необязательно)"
              value={store}
              onChange={(e) => setStore(e.target.value)}
              fullWidth
              placeholder="Например: Пятёрочка, Дикси, Метро"
              slotProps={{
                input: {
                  endAdornment: (
                    <AliasShortcut
                      scope="seller"
                      originalName={store}
                      onClick={() => setAliasScope('seller')}
                    />
                  ),
                },
              }}
            />

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
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {(tags ?? []).map((t) => (
                  <Chip
                    key={t.id}
                    label={t.name}
                    clickable
                    color={selectedTag === t.id ? 'primary' : 'default'}
                    variant={selectedTag === t.id ? 'filled' : 'outlined'}
                    onClick={() => setSelectedTag((prev) => (prev === t.id ? null : t.id))}
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
