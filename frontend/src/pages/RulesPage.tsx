import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import type { ReactNode } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    Checkbox,
    Chip,
    FormControlLabel,

    Stack,
    TextField,
    Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined'
import { BottomSheet } from '../components/common/BottomSheet'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useAliases, useApplyAliases, useCreateAlias, useDeleteAlias, useUpdateAlias } from '../hooks/useAliases'
import { useOnline } from '../hooks/useOnline'
import type { Alias, AliasScope } from '../api/types'
import { PageSearch } from '../components/common/PageSearch'

const SCOPE_LABEL: Record<AliasScope, string> = {
    seller: 'магазина',
    product: 'товара',
}

const SCOPE_CONFIG: Record<AliasScope, { title: string; emptyTitle: string; emptySubtitle: string; icon: ReactNode }> = {
    seller: {
        title: 'Правила для магазинов',
        emptyTitle: 'Правил для магазинов пока нет',
        emptySubtitle: 'Создайте правило: «перекресток» → «Перекрёсток»',
        icon: <StorefrontOutlinedIcon sx={{ fontSize: 22 }} />,
    },
    product: {
        title: 'Правила для товаров',
        emptyTitle: 'Правил для товаров пока нет',
        emptySubtitle: 'Создайте правило: «РАЭ Сырок…» → «Глазированный сырок»',
        icon: <Inventory2OutlinedIcon sx={{ fontSize: 22 }} />,
    },
}

function RuleCard({ item, onEdit, onDelete }: { item: Alias; onEdit: (item: Alias) => void; onDelete: (id: string) => void }) {
    return (
        <Card sx={{ aspectRatio: { xs: 'auto', sm: '1 / 1' }, minHeight: { xs: 240, sm: 0 }, p: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', justifyContent: 'space-between', minHeight: 24, flexShrink: 0 }}>
                <Chip size="small" label={item.is_regex ? 'regex' : 'common'} variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontVariantNumeric: 'tabular-nums', textAlign: 'right', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Приоритет ${item.priority}`}>
                    {item.priority}
                </Typography>
            </Stack>

            <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                    Исходное название
                </Typography>
                <Typography
                    sx={{
                        fontFamily: 'monospace',
                        fontSize: 13,
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                        WebkitLineClamp: 2,
                        overflow: 'hidden',
                    }}
                    title={item.original_name}
                >
                    {item.original_name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25, mb: 0.5 }}>
                    Показывать как
                </Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.alias_name}>
                    {item.alias_name}
                </Typography>
            </Box>

            <Stack direction="row" spacing={0.75} sx={{ mt: 1.5, justifyContent: 'space-between', flexShrink: 0 }}>
                <Button size="small" variant="outlined" onClick={() => onEdit(item)} sx={{ borderRadius: '6px', textTransform: 'none', px: 1.25, py: 0.5 }}>
                    Изменить
                </Button>
                <Button size="small" variant="outlined" color="error" onClick={() => onDelete(item.id)} sx={{ borderRadius: '6px', textTransform: 'none', px: 1.25, py: 0.5 }}>
                    Удалить
                </Button>
            </Stack>
        </Card>
    )
}

/** Правила — нормализация названий магазинов и товаров (реальный /api/v1/aliases). */
export function RulesPage() {
    const online = useOnline()
    const [search, setSearch] = useState('')
    const sellersQuery = useAliases('seller', search)
    const productsQuery = useAliases('product', search)
    const createAlias = useCreateAlias()
    const updateAlias = useUpdateAlias()
    const deleteAlias = useDeleteAlias()
    const applyAliases = useApplyAliases()

    const [scope, setScope] = useState<AliasScope>('seller')
    const [sheetOpen, setSheetOpen] = useState(false)
    const [confirmOpen, setConfirmOpen] = useState(false)
    const [original, setOriginal] = useState('')
    const [alias, setAlias] = useState('')
    const [isRegex, setIsRegex] = useState(false)
    const [priority, setPriority] = useState('0')
    const [formError, setFormError] = useState<string | null>(null)
    const [editingAlias, setEditingAlias] = useState<Alias | null>(null)
    const [deleteTarget, setDeleteTarget] = useState<Alias | null>(null)

    const queries = { seller: sellersQuery, product: productsQuery }
    const isLoading = sellersQuery.isLoading || productsQuery.isLoading
    const isError = sellersQuery.isError || productsQuery.isError
    const error = sellersQuery.error ?? productsQuery.error
    const sellerItems = sellersQuery.data?.pages.flatMap((page) => page.items) ?? []
    const productItems = productsQuery.data?.pages.flatMap((page) => page.items) ?? []

    const closeSheet = () => {
        setSheetOpen(false)
        setFormError(null)
        setEditingAlias(null)
    }

    const openCreate = (nextScope: AliasScope) => {
        setScope(nextScope)
        setEditingAlias(null)
        setOriginal('')
        setAlias('')
        setIsRegex(false)
        setPriority('0')
        setFormError(null)
        setSheetOpen(true)
    }

    const openEdit = (item: Alias) => {
        setScope(item.scope)
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
            setFormError('Заполните шаблон и название правила')
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
            if (editingAlias) await updateAlias.mutateAsync({ id: editingAlias.id, patch: draft })
            else await createAlias.mutateAsync(draft)
            closeSheet()
        } catch (e) {
            setFormError(e instanceof Error ? e.message : 'Не удалось сохранить правило')
        }
    }

    const handleEditorKeyDown = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
            if (!createAlias.isPending && !updateAlias.isPending) closeSheet()
            return
        }
        if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return
        event.preventDefault()
        event.stopPropagation()
        if (!createAlias.isPending && !updateAlias.isPending) void submit()
    }

    const runApplyAll = async () => {
        setConfirmOpen(false)
        try {
            await applyAliases.mutateAsync(undefined)
        } catch {
            // Ошибка отображается в Alert над карточками правил.
        }
    }

    const applyTotal = applyAliases.data == null
        ? 0
        : applyAliases.data.seller_updated_receipts + applyAliases.data.seller_updated_transactions + applyAliases.data.product_updated

    if (isLoading) return <LoadingState label="Загружаем правила…" />
    if (!online) return <OfflineState onRetry={() => { void sellersQuery.refetch(); void productsQuery.refetch() }} />
    if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => { void sellersQuery.refetch(); void productsQuery.refetch() }} />

    return (
        <Stack spacing={2}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <PageSearch value={search} onChange={setSearch} placeholder="Поиск по правилам" ariaLabel="Поиск по названиям правил" width="100%" />
                </Box>
                <Button variant="outlined" color="primary" startIcon={<RefreshIcon />} onClick={() => setConfirmOpen(true)} disabled={applyAliases.isPending} sx={{ flexShrink: 0 }}>
                    {applyAliases.isPending ? 'Применяем…' : 'Применить все'}
                </Button>
            </Stack>

            {applyAliases.isError && <Alert severity="error" sx={{ borderRadius: '8px' }}>{applyAliases.error instanceof Error ? applyAliases.error.message : 'Не удалось применить алиасы'}</Alert>}
            {applyAliases.isSuccess && applyTotal > 0 && <Alert severity="success" sx={{ borderRadius: '8px' }}>Обновлено записей: {applyTotal} (магазины: {applyAliases.data!.seller_updated_receipts} чеков + {applyAliases.data!.seller_updated_transactions} транзакций, товары: {applyAliases.data!.product_updated})</Alert>}
            {applyAliases.isSuccess && applyTotal === 0 && <Alert severity="info" sx={{ borderRadius: '8px' }}>Все записи уже соответствуют алиасам — ничего не изменено</Alert>}
            {createAlias.isSuccess && !sheetOpen && <Alert severity="success" sx={{ borderRadius: '8px' }}>Правило создано и применено к подходящим записям</Alert>}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2, alignItems: 'start' }}>
                {(['seller', 'product'] as const).map((columnScope) => {
                    const config = SCOPE_CONFIG[columnScope]
                    const query = queries[columnScope]
                    const items = columnScope === 'seller' ? sellerItems : productItems
                    return (
                        <Stack key={columnScope} spacing={1.5} sx={columnScope === 'product' ? { borderLeft: { md: '1px solid' }, borderColor: 'divider', pl: { md: 2 } } : undefined}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                                <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: '8px', bgcolor: 'action.hover', color: 'primary.main' }}>
                                    {config.icon}
                                </Box>
                                <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{config.title}</Typography>
                                <Typography variant="caption" color="text.secondary">{items.length}</Typography>
                                <Box sx={{ flex: 1 }} />
                                <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCreate(columnScope)} sx={{ flexShrink: 0 }}>
                                    Добавить
                                </Button>
                            </Stack>

                            {items.length === 0 ? (
                                <EmptyState title={config.emptyTitle} subtitle={config.emptySubtitle} actionLabel="Создать правило" onAction={() => openCreate(columnScope)} />
                            ) : (
                                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 1.5 }}>
                                    {items.map((item) => <RuleCard key={item.id} item={item} onEdit={openEdit} onDelete={() => setDeleteTarget(item)} />)}
                                </Box>
                            )}
                            {query.hasNextPage && <Button variant="outlined" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage} sx={{ alignSelf: 'flex-start' }}>{query.isFetchingNextPage ? 'Загружаем…' : 'Загрузить ещё'}</Button>}
                        </Stack>
                    )
                })}
            </Box>

            <BottomSheet open={sheetOpen} onClose={closeSheet} title={editingAlias ? `Редактировать правило ${SCOPE_LABEL[scope]}` : `Новое правило ${SCOPE_LABEL[scope]}`}>
                <Stack spacing={2} onKeyDown={handleEditorKeyDown}>
                    {formError && <Alert severity="error">{formError}</Alert>}
                    <TextField label="Шаблон" value={original} onChange={(e) => setOriginal(e.target.value)} fullWidth placeholder={scope === 'seller' ? 'например: перекресток|перекрёсток' : 'например: РАЭ Сырок тв.гл.с вар.сг.15%45г'} autoFocus />
                    <TextField label="Название по правилу" value={alias} onChange={(e) => setAlias(e.target.value)} fullWidth placeholder={scope === 'seller' ? 'например: Перекрёсток' : 'например: Глазированный сырок'} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}>
                        <FormControlLabel control={<Checkbox checked={isRegex} onChange={(e) => setIsRegex(e.target.checked)} />} label="Регулярное выражение" />
                        <TextField label="Приоритет" value={priority} onChange={(e) => setPriority(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" sx={{ width: { xs: '100%', sm: 120 } }} placeholder="0" slotProps={{ htmlInput: { maxLength: 4 } }} />
                    </Stack>
                    <Box sx={{ position: 'sticky', bottom: 0, zIndex: 1, pt: 1, pb: 'env(safe-area-inset-bottom)', bgcolor: 'background.paper' }}>
                        <Button fullWidth variant="contained" onClick={submit} disabled={createAlias.isPending || updateAlias.isPending} size="large">
                            {createAlias.isPending || updateAlias.isPending ? 'Сохраняем…' : editingAlias ? 'Сохранить изменения' : 'Сохранить'}
                        </Button>
                    </Box>
                </Stack>
            </BottomSheet>

            <ConfirmDialog open={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => void runApplyAll()} tone="primary" title="Применить все алиасы?" message="Все алиасы магазинов и товаров будут применены к существующим чекам и транзакциям. Операция переименовывает подходящие записи и необратима." confirmLabel="Применить" pending={applyAliases.isPending} error={applyAliases.isError ? (applyAliases.error instanceof Error ? applyAliases.error.message : null) : null} />
            <ConfirmDialog
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (!deleteTarget) return
                    deleteAlias.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
                }}
                title="Удалить правило?"
                message={deleteTarget ? `Правило «${deleteTarget.original_name}» → «${deleteTarget.alias_name}» будет удалено. Существующие записи сохранятся.` : ''}
                confirmLabel="Удалить"
                pending={deleteAlias.isPending}
                error={deleteAlias.isError ? (deleteAlias.error instanceof Error ? deleteAlias.error.message : 'Не удалось удалить правило') : null}
            />
        </Stack>
    )
}
