import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  ClickAwayListener,
  CircularProgress,
  Paper,
  Popper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { TagAutocomplete } from '../common/TagAutocomplete'
import { AutoTagHint } from './AutoTagHint'
import { NumericField } from '../common/NumericField'
import { useStores, useUpdateTransaction } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { parseNum } from '../../lib/numbers'
import type { Store, Tag, TransactionUpdatePatch, TransactionView } from '../../api/types'
import { matchesOptionSearch } from '../../lib/transactionInteractions.mjs'

export type QuickEditField =
  | 'date'
  | 'store'
  | 'tagId'
  | 'name'
  | 'quantity'
  | 'price'
  | 'income'
  | 'expense'
  | 'comment'

export interface QuickEditTarget {
  tx: TransactionView
  field: QuickEditField
  x: number
  y: number
}

const FIELD_LABELS: Record<QuickEditField, string> = {
  date: 'Дата',
  store: 'Магазин',
  tagId: 'Тег',
  name: 'Название',
  quantity: 'Количество',
  price: 'Цена',
  income: 'Доход',
  expense: 'Расход',
  comment: 'Комментарий',
}

function initialValue(target: QuickEditTarget): string {
  const { tx, field } = target
  if (field === 'date') return tx.date
  if (field === 'store') return tx.sellerNameSource ?? tx.store ?? ''
  if (field === 'name') return tx.name
  if (field === 'comment') return tx.comment ?? ''
  if (field === 'quantity') return tx.quantity === null ? '' : String(tx.quantity)
  if (field === 'price') return tx.price === null ? '' : String(tx.price)
  if (field === 'income') return tx.income === null ? '' : String(tx.income)
  if (field === 'expense') return tx.expense === null ? '' : String(tx.expense)
  return ''
}

function storeLabel(store: Store): string {
  return store.alias_name || store.normalized_seller_name || store.seller_name
}

function findMatchingStore(target: QuickEditTarget | null, stores: Store[]): Store | null {
  if (!target || target.field !== 'store') return null
  return stores.find((candidate) => (
    candidate.seller_id === target.tx.sellerId
    || (target.tx.sellerId === null && storeLabel(candidate) === target.tx.store)
  )) ?? null
}

function numericPatch(target: QuickEditTarget, value: number): TransactionUpdatePatch {
  const { tx, field } = target
  if (field === 'income' || field === 'expense') {
    const quantity = tx.quantity ?? 1
    return {
      amount: value,
      price: Math.round((value / quantity) * 100) / 100,
      operation_type: field === 'income' ? 2 : 1,
    }
  }
  if (field === 'quantity') {
    const oldAmount = tx.income ?? tx.expense ?? 0
    const unitPrice = tx.price ?? oldAmount / (tx.quantity ?? 1)
    return {
      quantity: value,
      price: Math.round(unitPrice * 100) / 100,
      amount: Math.round(unitPrice * value * 100) / 100,
    }
  }
  if (field === 'price') {
    const patch: TransactionUpdatePatch = { price: value }
    const quantity = tx.quantity ?? 1
    patch.amount = Math.round(value * quantity * 100) / 100
    return patch
  }
  return {}
}

export function QuickEditPopover({
  target,
  tags,
  onClose,
  onContextMenuThrough,
}: {
  target: QuickEditTarget | null
  tags: Tag[]
  onClose: () => void
  onContextMenuThrough?: (x: number, y: number, overlay: HTMLElement) => void
}) {
  const updateTx = useUpdateTransaction()
  const storesQuery = useStores()
  const stores = useMemo(() => storesQuery.data ?? [], [storesQuery.data])
  const [value, setValue] = useState(() => target ? initialValue(target) : '')
  const [tagId, setTagId] = useState<string | null>(() => target?.tx.tagId ?? null)
  const [selectedStore, setSelectedStore] = useState<Store | null>(() => findMatchingStore(target, stores))
  const [error, setError] = useState<string | null>(null)
  const anchorEl = useMemo(() => ({
    getBoundingClientRect: () => new DOMRect(target?.x ?? 0, target?.y ?? 0, 0, 0),
  }), [target?.x, target?.y])

  useEffect(() => {
    if (!target) return
    const matchingStore = findMatchingStore(target, stores)
    setValue(initialValue(target))
    setTagId(target.tx.tagId)
    setSelectedStore(matchingStore)
    if (target.field === 'store' && matchingStore) setValue(storeLabel(matchingStore))
    setError(null)
  }, [stores, target])

  if (!target) return null

  const isNumeric = ['quantity', 'price', 'income', 'expense'].includes(target.field)
  const numericMissing = isNumeric && value === ''
  const numericValue = isNumeric && !numericMissing ? parseNum(value) : NaN
  const numericInvalid = isNumeric && !numericMissing && (
    !Number.isFinite(numericValue)
    || numericValue < 0
    || (target.field === 'quantity' && numericValue <= 0)
  )

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    setError(null)

    let patch: TransactionUpdatePatch
    if (target.field === 'tagId') {
      patch = { tag_id: tagId }
    } else if (target.field === 'date') {
      if (!value) return setError('Укажите дату')
      patch = { datetime: `${value}T12:00:00Z` }
    } else if (target.field === 'name') {
      if (!value.trim()) return setError('Название не может быть пустым')
      patch = { name: value.trim() }
    } else if (target.field === 'store') {
      patch = { seller_name: (selectedStore?.seller_name ?? value.trim()) || null }
    } else if (target.field === 'comment') {
      patch = { comment: value.trim() || null }
    } else {
      if (numericMissing || numericInvalid) {
        return setError(target.field === 'quantity' ? 'Количество должно быть больше нуля' : 'Введите число не меньше нуля')
      }
      patch = numericPatch(target, numericValue)
    }

    try {
      await updateTx.mutateAsync({ id: target.tx.id, patch })
      onClose()
    } catch (submitError) {
      setError(messageFromError(submitError))
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key !== 'Escape' || updateTx.isPending) return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-start"
      modifiers={[
        { name: 'offset', options: { offset: [0, 8] } },
        { name: 'preventOverflow', options: { padding: 12 } },
      ]}
      sx={{ zIndex: (theme) => theme.zIndex.modal }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onContextMenuThrough?.(event.clientX, event.clientY, event.currentTarget)
      }}
    >
      <ClickAwayListener onClickAway={() => { if (!updateTx.isPending) onClose() }} mouseEvent="onMouseDown">
        <Paper
          elevation={8}
          sx={{
            width: 320,
            maxWidth: 'calc(100vw - 24px)',
            p: 2,
            borderRadius: '8px',
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Box component="form" onSubmit={(event) => void submit(event)} onKeyDown={handleKeyDown}>
            <Stack spacing={1.5}>
              <Box>
                <Typography variant="subtitle2">Быстрое редактирование</Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                  {FIELD_LABELS[target.field]} · {target.tx.name}
                </Typography>
              </Box>

              {error && <Alert severity="error">{error}</Alert>}

              {target.field === 'tagId' ? (
                <Stack spacing={0.75}>
                  <TagAutocomplete tags={tags} value={tagId} onChange={setTagId} />
                  <AutoTagHint source={target.tx.tagSource} confidence={target.tx.tagConfidence} />
                </Stack>
              ) : target.field === 'store' ? (
                <Autocomplete
                  freeSolo
                  disablePortal
                  autoHighlight
                  autoSelect
                  selectOnFocus
                  loading={storesQuery.isLoading}
                  options={stores}
                  filterOptions={(options, state) => options.filter((store) => matchesOptionSearch(storeLabel(store), state.inputValue))}
                  value={selectedStore}
                  inputValue={value}
                  onChange={(_, nextStore) => {
                    if (typeof nextStore === 'string') {
                      setSelectedStore(null)
                      setValue(nextStore)
                    } else {
                      setSelectedStore(nextStore)
                      setValue(nextStore ? storeLabel(nextStore) : '')
                    }
                  }}
                  onInputChange={(_, nextValue, reason) => {
                    if (reason === 'input' || reason === 'clear') {
                      setSelectedStore(null)
                      setValue(nextValue)
                    }
                  }}
                  getOptionLabel={(option) => typeof option === 'string' ? option : storeLabel(option)}
                  isOptionEqualToValue={(option, optionValue) => option.seller_id === optionValue.seller_id}
                  noOptionsText="Магазин не найден — Enter сохранит новое имя"
                  renderOption={(props, option, state) => {
                    const { key: _defaultKey, ...optionProps } = props
                    return (
                      <li {...optionProps} key={`${option.seller_id}:${state.index}`}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <span>{storeLabel(option)}</span>
                          {option.alias_name && <Chip label="алиас" size="small" color="primary" />}
                        </Stack>
                      </li>
                    )
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      autoFocus
                      label="Магазин"
                      placeholder="Найдите или введите новый"
                      helperText={selectedStore?.alias_name
                        ? `Алиас: оригинал «${selectedStore.seller_name}»`
                        : 'Можно выбрать существующий или ввести новый'}
                    />
                  )}
                />
              ) : isNumeric ? (
                <NumericField
                  label={FIELD_LABELS[target.field]}
                  value={value}
                  onChange={setValue}
                  min={target.field === 'quantity' ? 0.01 : 0}
                  step={target.field === 'quantity' ? 1 : 10}
                  required
                  error={numericInvalid}
                  helperText={target.field === 'quantity' ? 'Значение больше нуля' : 'Значение в рублях'}
                />
              ) : (
                <TextField
                  autoFocus
                  fullWidth
                  label={FIELD_LABELS[target.field]}
                  value={value}
                  onChange={(event) => setValue(event.target.value)}
                  type={target.field === 'date' ? 'date' : 'text'}
                  required={target.field === 'date' || target.field === 'name'}
                  multiline={target.field === 'comment'}
                  minRows={target.field === 'comment' ? 2 : undefined}
                  slotProps={target.field === 'date' ? { inputLabel: { shrink: true } } : undefined}
                />
              )}

              <Stack direction="row" spacing={1} justifyContent="space-between">
                <Button color="inherit" onClick={onClose} disabled={updateTx.isPending}>
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={updateTx.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
                  disabled={updateTx.isPending || numericMissing || numericInvalid}
                >
                  Сохранить
                </Button>
              </Stack>
            </Stack>
          </Box>
        </Paper>
      </ClickAwayListener>
    </Popper>
  )
}
