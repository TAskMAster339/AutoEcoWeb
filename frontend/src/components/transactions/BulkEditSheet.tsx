import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { BottomSheet } from '../common/BottomSheet'
import { TagAutocomplete } from '../common/TagAutocomplete'
import { messageFromError } from '../../api/client'
import { useBulkUpdateTransactions } from '../../hooks/useTransactions'
import type { Store, Tag, TransactionUpdatePatch } from '../../api/types'
import { matchesOptionSearch } from '../../lib/transactionInteractions.mjs'

type FieldAction = 'unchanged' | 'set' | 'clear'
type OperationAction = 'unchanged' | 'expense' | 'income'

function storeLabel(store: Store): string {
  return store.alias_name || store.normalized_seller_name || store.seller_name
}

export function BulkEditSheet({
  open,
  selectedIds,
  tags,
  stores,
  onClose,
  onSaved,
}: {
  open: boolean
  selectedIds: string[]
  tags: Tag[]
  stores: Store[]
  onClose: () => void
  onSaved: () => void
}) {
  const bulkUpdate = useBulkUpdateTransactions()
  const [tagAction, setTagAction] = useState<FieldAction>('unchanged')
  const [tagId, setTagId] = useState<string | null>(null)
  const [storeAction, setStoreAction] = useState<FieldAction>('unchanged')
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [storeInput, setStoreInput] = useState('')
  const [operationAction, setOperationAction] = useState<OperationAction>('unchanged')
  const [clearComment, setClearComment] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setTagAction('unchanged')
    setTagId(null)
    setStoreAction('unchanged')
    setSelectedStore(null)
    setStoreInput('')
    setOperationAction('unchanged')
    setClearComment(false)
    setError(null)
  }, [open])

  const patch = useMemo<TransactionUpdatePatch>(() => {
    const next: TransactionUpdatePatch = {}
    if (tagAction === 'clear') next.tag_id = null
    if (tagAction === 'set' && tagId) next.tag_id = tagId
    if (storeAction === 'clear') next.seller_name = null
    if (storeAction === 'set') next.seller_name = selectedStore?.seller_name ?? storeInput.trim()
    if (operationAction !== 'unchanged') next.operation_type = operationAction === 'income' ? 2 : 1
    if (clearComment) next.comment = null
    return next
  }, [clearComment, operationAction, selectedStore, storeAction, storeInput, tagAction, tagId])

  const changedLabels = [
    tagAction !== 'unchanged' ? 'тег' : null,
    storeAction !== 'unchanged' ? 'магазин' : null,
    operationAction !== 'unchanged' ? 'тип операции' : null,
    clearComment ? 'комментарий' : null,
  ].filter(Boolean)
  const hasChanges = Object.keys(patch).length > 0
  const invalidStore = storeAction === 'set' && !patch.seller_name
  const invalidTag = tagAction === 'set' && !tagId

  const resetAndClose = () => {
    if (bulkUpdate.isPending) return
    setError(null)
    onClose()
  }

  const submit = async () => {
    if (!hasChanges || invalidStore || invalidTag) return
    setError(null)
    try {
      await bulkUpdate.mutateAsync({ ids: selectedIds, patch })
      onSaved()
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      onClose()
    } catch (submitError) {
      setError(messageFromError(submitError))
    }
  }

  return (
    <BottomSheet open={open} onClose={resetAndClose} title="Изменить выбранные" maxWidth={560}>
      <Stack
        component="form"
        spacing={2}
        onSubmit={(event) => {
          event.preventDefault()
          if (!bulkUpdate.isPending) void submit()
        }}
      >
        <Box sx={{ p: 1.5, borderRadius: '8px', bgcolor: 'action.hover' }}>
          <Typography variant="subtitle2">
            Будет изменено: {selectedIds.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {changedLabels.length ? `Поля: ${changedLabels.join(', ')}` : 'Выберите хотя бы одно изменение'}
          </Typography>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Stack spacing={1}>
          <Typography variant="subtitle2">Тег</Typography>
          <Select
            size="small"
            value={tagAction}
            onChange={(event) => setTagAction(event.target.value as FieldAction)}
            aria-label="Действие с тегом"
          >
            <MenuItem value="unchanged">Не изменять</MenuItem>
            <MenuItem value="set">Назначить тег</MenuItem>
            <MenuItem value="clear">Очистить тег</MenuItem>
          </Select>
          {tagAction === 'set' && <TagAutocomplete tags={tags} value={tagId} onChange={setTagId} />}
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Магазин</Typography>
          <Select
            size="small"
            value={storeAction}
            onChange={(event) => setStoreAction(event.target.value as FieldAction)}
            aria-label="Действие с магазином"
          >
            <MenuItem value="unchanged">Не изменять</MenuItem>
            <MenuItem value="set">Изменить магазин</MenuItem>
            <MenuItem value="clear">Очистить магазин</MenuItem>
          </Select>
          {storeAction === 'set' && (
            <Autocomplete
              freeSolo
              openOnFocus
              autoHighlight
              options={stores}
              filterOptions={(options, state) => options.filter((store) => matchesOptionSearch(storeLabel(store), state.inputValue))}
              value={selectedStore}
              inputValue={storeInput}
              onChange={(_, value) => {
                if (typeof value === 'string') {
                  setSelectedStore(null)
                  setStoreInput(value)
                } else {
                  setSelectedStore(value)
                  setStoreInput(value ? storeLabel(value) : '')
                }
              }}
              onInputChange={(_, value, reason) => {
                if (reason === 'input' || reason === 'clear') {
                  setSelectedStore(null)
                  setStoreInput(value)
                }
              }}
              getOptionLabel={(option) => typeof option === 'string' ? option : storeLabel(option)}
              isOptionEqualToValue={(option, value) => option.seller_id === value.seller_id}
              noOptionsText="Магазин не найден — можно сохранить новое имя"
              renderOption={(props, option) => {
                const { key: _key, ...optionProps } = props
                return (
                  <li {...optionProps} key={option.seller_id}>
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
                  label="Найти магазин или ввести новый"
                  error={invalidStore}
                  helperText={invalidStore ? 'Выберите или введите магазин' : 'Поиск работает по доступным вариантам'}
                />
              )}
            />
          )}
        </Stack>

        <Stack spacing={1}>
          <Typography variant="subtitle2">Тип операции</Typography>
          <ToggleButtonGroup
            value={operationAction}
            exclusive
            onChange={(_, value: OperationAction | null) => value && setOperationAction(value)}
            fullWidth
            size="small"
            aria-label="Новый тип операции"
          >
            <ToggleButton value="unchanged">Не менять</ToggleButton>
            <ToggleButton value="expense">Расход</ToggleButton>
            <ToggleButton value="income">Доход</ToggleButton>
          </ToggleButtonGroup>
        </Stack>

        <FormControlLabel
          control={<Checkbox checked={clearComment} onChange={(event) => setClearComment(event.target.checked)} />}
          label="Очистить комментарий у выбранных операций"
        />

        <Stack direction="row" spacing={1} justifyContent="space-between">
          <Button type="button" color="inherit" onClick={resetAndClose} disabled={bulkUpdate.isPending}>Отмена</Button>
          <Button
            type="submit"
            variant="contained"
            startIcon={bulkUpdate.isPending ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
            disabled={!hasChanges || invalidStore || invalidTag || bulkUpdate.isPending || selectedIds.length === 0}
          >
            Применить к {selectedIds.length}
          </Button>
        </Stack>
      </Stack>
    </BottomSheet>
  )
}
