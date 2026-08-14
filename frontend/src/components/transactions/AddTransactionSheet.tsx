import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
} from '@mui/material'
import { BottomSheet } from '../common/BottomSheet'
import { NumericField } from '../common/NumericField'
import { TagAutocomplete } from '../common/TagAutocomplete'
import { parseNum } from '../../lib/numbers'
import { useUiStore } from '../../store/uiStore'
import { useTags } from '../../hooks/useTags'
import { useCreateTransaction, useStores } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { todayIso } from '../../lib/format'
import { colors } from '../../theme'
import type { Store } from '../../api/types'

/**
 * Bottom sheet: ручная транзакция БЕЗ чека — минимальная единица учёта.
 * POST /api/v1/transactions (receipt_id = null). Сумма вычисляется
 * автоматически: цена (обязательная) × количество (по умолчанию 1).
 */
export function AddTransactionSheet() {
    const open = useUiStore((s) => s.transactionSheetOpen)
    const close = useUiStore((s) => s.closeTransactionSheet)
    const { data: tags } = useTags()
    const { data: stores } = useStores()
    const createTx = useCreateTransaction()

    const [type, setType] = useState<'expense' | 'income'>('expense')
    const [date, setDate] = useState(todayIso())
    const [name, setName] = useState('')
    const [store, setStore] = useState('')
    const [selectedStore, setSelectedStore] = useState<Store | null>(null)
    const [comment, setComment] = useState('')
    const [price, setPrice] = useState('')
    const [quantity, setQuantity] = useState('1')
    const [selectedTag, setSelectedTag] = useState<string | null>(null)
    const [formError, setFormError] = useState<string | null>(null)

    const resetForm = () => {
        setName('')
        setStore('')
        setSelectedStore(null)
        setComment('')
        setPrice('')
        setQuantity('1')
        setSelectedTag(null)
        setType('expense')
        setFormError(null)
    }

    useEffect(() => {
        if (!open) resetForm()
    }, [open])

    // сумма = цена × количество (автоматически, с округлением до копеек)
    const priceNum = price ? parseNum(price) : NaN
    const qtyNum = quantity ? parseNum(quantity) : NaN
    const computedAmount =
        Number.isFinite(priceNum) && Number.isFinite(qtyNum)
            ? Math.round(priceNum * qtyNum * 100) / 100
            : null
    const amountText =
        computedAmount !== null ? computedAmount.toFixed(2).replace('.', ',') : ''
    const storeOptions = useMemo(() => stores ?? [], [stores])

    const submit = async () => {
        setFormError(null)

        if (!name.trim()) {
            setFormError('Укажите название транзакции')
            return
        }
        if (!Number.isFinite(priceNum) || priceNum < 0) {
            setFormError('Укажите цену не меньше нуля')
            return
        }
        if (!Number.isFinite(qtyNum) || qtyNum <= 0) {
            setFormError('Количество должно быть больше нуля')
            return
        }

        try {
            await createTx.mutateAsync({
                name: name.trim(),
                seller_name: selectedStore ? selectedStore.seller_name : store.trim() || null,
                amount: computedAmount!,
                quantity: qtyNum,
                price: priceNum,
                // полдень UTC — чтобы дата не «уезжала» ни в одном часовом поясе
                datetime: `${date}T12:00:00Z`,
                operation_type: type === 'income' ? 2 : 1,
                tag_id: selectedTag,
                comment: comment.trim() || null,
            })
            close()
        } catch (e) {
            setFormError(messageFromError(e))
        }
    }

    const handleFormKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!createTx.isPending) close()
            return
        }
        if (
            event.key !== 'Enter' ||
            event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ||
            event.target instanceof HTMLTextAreaElement ||
            (event.target instanceof HTMLElement && event.target.getAttribute('role') === 'combobox')
        ) return
        event.preventDefault()
        event.stopPropagation()
        if (!createTx.isPending) void submit()
    }

    return (
        <BottomSheet open={open} onClose={close} title="Новая транзакция">
            <Stack spacing={2} onKeyDown={handleFormKeyDown}>
                {formError && <Alert severity="error">{formError}</Alert>}

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
                />

                <Autocomplete
                    freeSolo
                    openOnFocus
                    autoHighlight
                    autoSelect
                    selectOnFocus
                    options={storeOptions}
                    value={selectedStore}
                    inputValue={store}
                    onChange={(_, value) => {
                        if (typeof value === 'string') {
                            setSelectedStore(null)
                            setStore(value)
                        } else {
                            setSelectedStore(value)
                            setStore(value ? value.alias_name || value.normalized_seller_name || value.seller_name : '')
                        }
                    }}
                    onInputChange={(_, value, reason) => {
                        if (reason === 'input' || reason === 'clear') {
                            setSelectedStore(null)
                            setStore(value)
                        }
                    }}
                    getOptionLabel={(option) => typeof option === 'string' ? option : option.alias_name || option.normalized_seller_name || option.seller_name}
                    isOptionEqualToValue={(option, value) => option.seller_id === value.seller_id}
                    noOptionsText="Магазин не найден — Enter создаст новое имя"
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
                        />
                    )}
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

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <NumericField
                        label="Цена, ₽"
                        value={price}
                        onChange={setPrice}
                        required
                        min={0}
                        step={1}
                        placeholder="139,90"
                        error={price !== '' && (!Number.isFinite(priceNum) || priceNum < 0)}
                        helperText={price !== '' && (!Number.isFinite(priceNum) || priceNum < 0) ? 'Цена не может быть отрицательной' : 'Можно указать 0 для подарка или скидки'}
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

                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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

                <TagAutocomplete tags={tags ?? []} value={selectedTag} onChange={setSelectedTag} />

                <Box sx={{ position: 'sticky', bottom: 0, zIndex: 1, pt: 1, pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper' }}>
                    <Button variant="contained" onClick={submit} disabled={createTx.isPending} size="large" fullWidth>
                        {createTx.isPending ? <CircularProgress size={20} color="inherit" /> : 'Сохранить транзакцию'}
                    </Button>
                </Box>
            </Stack>
        </BottomSheet>
    )
}
