import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
} from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import AddLinkOutlinedIcon from '@mui/icons-material/AddLinkOutlined'
import { BottomSheet } from '../common/BottomSheet'
import { NumericField } from '../common/NumericField'
import { ConfirmDialog } from '../common/ConfirmDialog'
import { CreateAliasDialog } from '../common/CreateAliasDialog'
import { TagAutocomplete } from '../common/TagAutocomplete'
import { useTags } from '../../hooks/useTags'
import { useDeleteTransaction, useStores, useUpdateTransaction } from '../../hooks/useTransactions'
import { messageFromError } from '../../api/client'
import { todayIso } from '../../lib/format'
import { parseNum } from '../../lib/numbers'
import { colors } from '../../theme'
import type { AliasScope, Store, TransactionUpdatePatch, TransactionView } from '../../api/types'

interface EditTransactionDialogProps {
    tx: TransactionView | null
    onClose: () => void
    onSaved?: (id: string) => void
}

/** Редактирование повторяет форму добавления, но отправляет PATCH и позволяет удалить транзакцию. */
export function EditTransactionDialog({ tx, onClose, onSaved }: EditTransactionDialogProps) {
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
    const [formError, setFormError] = useState<string | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [aliasScope, setAliasScope] = useState<AliasScope | null>(null)

    const open = tx !== null

    useEffect(() => {
        if (!tx) return
        const amount = tx.income ?? tx.expense ?? null
        const matchingStore = (stores ?? []).find((candidate) => {
            const label = candidate.alias_name || candidate.normalized_seller_name || candidate.seller_name
            return candidate.seller_id === tx.sellerId || (tx.sellerId === null && label === tx.store)
        }) ?? null

        setType(tx.income !== null && tx.income !== undefined ? 'income' : 'expense')
        setDate(tx.date || todayIso())
        setName(tx.name)
        setSelectedStore(matchingStore)
        setStore(matchingStore ? matchingStore.alias_name || matchingStore.normalized_seller_name || matchingStore.seller_name : tx.store ?? '')
        setStoreEdited(false)
        setComment(tx.comment ?? '')
        setPrice(tx.price !== null && tx.price !== undefined ? String(tx.price) : amount !== null ? String(amount) : '')
        setQuantity(tx.quantity !== null && tx.quantity !== undefined ? String(tx.quantity) : '1')
        setSelectedTag(tx.tagId)
        setFormError(null)
        setDeleteError(null)
        setConfirmOpen(false)
        setAliasScope(null)
    }, [stores, tx])

    const priceNum = price ? parseNum(price) : NaN
    const qtyNum = quantity ? parseNum(quantity) : NaN
    const computedAmount =
        Number.isFinite(priceNum) && Number.isFinite(qtyNum)
            ? Math.round(priceNum * qtyNum * 100) / 100
            : null
    const amountText = computedAmount !== null ? computedAmount.toFixed(2).replace('.', ',') : ''
    const storeOptions = useMemo(() => stores ?? [], [stores])

    if (!tx) return null

    const submit = async () => {
        setFormError(null)
        if (!name.trim()) return setFormError('Укажите название транзакции')
        if (!Number.isFinite(priceNum) || priceNum < 0) return setFormError('Укажите цену не меньше нуля')
        if (!Number.isFinite(qtyNum) || qtyNum <= 0) return setFormError('Количество должно быть больше нуля')

        const patch: TransactionUpdatePatch = {}
        const newName = name.trim()
        const newStore = selectedStore ? selectedStore.seller_name : store.trim() || null
        const newType = type === 'income' ? 2 : 1
        if (newName !== tx.name) patch.name = newName
        if (storeEdited && newStore !== (tx.sellerNameSource ?? null)) patch.seller_name = newStore
        if (newType !== (tx.income !== null && tx.income !== undefined ? 2 : 1)) patch.operation_type = newType

        const newDate = `${date}T12:00:00Z`
        if (newDate !== `${tx.date}T12:00:00Z`) patch.datetime = newDate

        const oldQty = tx.quantity !== null && tx.quantity !== undefined ? Number(tx.quantity) : 1
        const oldPrice = tx.price !== null && tx.price !== undefined ? Number(tx.price) : tx.income ?? tx.expense ?? computedAmount
        if (qtyNum !== oldQty || priceNum !== oldPrice) {
            patch.price = priceNum
            patch.quantity = qtyNum
            patch.amount = computedAmount!
        } else if (computedAmount !== null && computedAmount !== (tx.income ?? tx.expense)) {
            patch.amount = computedAmount
        }
        if (selectedTag !== tx.tagId) patch.tag_id = selectedTag
        const newComment = comment.trim() || null
        if (newComment !== tx.comment) patch.comment = newComment

        try {
            await updateTx.mutateAsync({ id: tx.id, patch })
            onSaved?.(tx.id)
            onClose()
        } catch (error) {
            setFormError(messageFromError(error))
        }
    }

    const handleDelete = async () => {
        setDeleteError(null)
        try {
            await deleteTx.mutateAsync(tx.id)
            setConfirmOpen(false)
            onClose()
        } catch (error) {
            setDeleteError(messageFromError(error))
        }
    }

    const close = () => {
        if (!updateTx.isPending && !deleteTx.isPending) onClose()
    }

    const handleFormKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            close()
            return
        }
        if (
            event.key !== 'Enter' ||
            !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey ||
            confirmOpen || aliasScope !== null
        ) return
        event.preventDefault()
        event.stopPropagation()
        if (!updateTx.isPending && !deleteTx.isPending) void submit()
    }

    return (
        <>
            <BottomSheet open={open} onClose={close} title="Изменить транзакцию">
                <Stack spacing={2} onKeyDown={handleFormKeyDown}>
                    {formError && <Alert severity="error">{formError}</Alert>}

                    <ToggleButtonGroup
                        value={type}
                        exclusive
                        onChange={(_, value) => value && setType(value)}
                        size="small"
                        fullWidth
                        aria-label="Тип операции"
                    >
                        <ToggleButton value="expense" sx={{ flex: 1, color: colors.red }}>Расход</ToggleButton>
                        <ToggleButton value="income" sx={{ flex: 1, color: colors.green }}>Доход</ToggleButton>
                    </ToggleButtonGroup>

                    <Stack direction="row" spacing={1} alignItems="flex-start">
                        <TextField
                            label="Название"
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            fullWidth
                            required
                            autoFocus
                            placeholder="Например: Кофе, проезд, зарплата"
                            sx={{ '& .MuiInputBase-root': { height: 56 } }}
                        />
                        <Tooltip title="Создать алиас названия">
                            <span>
                                <IconButton
                                    aria-label="Создать алиас названия"
                                    color="primary"
                                    onClick={() => setAliasScope('product')}
                                    disabled={!name.trim()}
                                    sx={{ width: 56, minWidth: 56, height: 56, minHeight: 56, p: 0, mt: 0, borderRadius: '6px', border: '1px solid', borderColor: 'divider', flexShrink: 0 }}
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
                                    setStoreEdited(true)
                                }}
                                onInputChange={(_, value, reason) => {
                                    if (reason === 'input' || reason === 'clear') {
                                        setSelectedStore(null)
                                        setStore(value)
                                        setStoreEdited(true)
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
                                        sx={{ '& .MuiInputBase-root': { height: 56 } }}
                                    />
                                )}
                            />
                        </Box>
                        <Tooltip title="Создать алиас магазина">
                            <span>
                                <IconButton
                                    aria-label="Создать алиас магазина"
                                    color="primary"
                                    onClick={() => setAliasScope('seller')}
                                    disabled={!store.trim()}
                                    sx={{ width: 56, minWidth: 56, height: 56, minHeight: 56, p: 0, mt: 0, borderRadius: '6px', border: '1px solid', borderColor: 'divider', flexShrink: 0 }}
                                >
                                    <AddLinkOutlinedIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>

                    <TextField
                        label="Комментарий (необязательно)"
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
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
                        <TextField label="Дата" type="date" value={date} onChange={(event) => setDate(event.target.value)} fullWidth slotProps={{ inputLabel: { shrink: true } }} />
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
                        <Stack direction="row" spacing={1}>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<DeleteOutlineIcon />}
                                onClick={() => { setDeleteError(null); setConfirmOpen(true) }}
                                disabled={updateTx.isPending || deleteTx.isPending}
                                sx={{ flex: 1, minWidth: 0, minHeight: 48 }}
                            >
                                Удалить
                            </Button>
                            <Button
                                variant="contained"
                                onClick={() => void submit()}
                                disabled={updateTx.isPending || deleteTx.isPending}
                                sx={{ flex: 1, minWidth: 0, minHeight: 48 }}
                            >
                                {updateTx.isPending ? <CircularProgress size={20} color="inherit" /> : 'Сохранить'}
                            </Button>
                        </Stack>
                    </Box>
                </Stack>
            </BottomSheet>

            <ConfirmDialog
                open={confirmOpen}
                title="Удалить транзакцию?"
                message={`«${tx.name}» будет удалена безвозвратно.`}
                confirmLabel="Удалить"
                pending={deleteTx.isPending}
                error={deleteError}
                onConfirm={() => void handleDelete()}
                onClose={() => setConfirmOpen(false)}
            />
            <CreateAliasDialog
                open={aliasScope !== null}
                scope={aliasScope ?? 'product'}
                originalName={aliasScope === 'seller' ? store : name}
                onClose={() => setAliasScope(null)}
            />
        </>
    )
}
