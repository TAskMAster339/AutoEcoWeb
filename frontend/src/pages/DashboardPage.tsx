import { useMemo, useState } from 'react'
import { Box, Button, Stack, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { ReceiptCard } from '../components/dashboard/ReceiptCard'
import { mapReceipt } from '../lib/receipts'
import { rangeFor } from '../lib/period'
import { LoadingState, EmptyState, ErrorState, OfflineState } from '../components/common/States'
import { useReceipts } from '../hooks/useReceipts'
import { useTags } from '../hooks/useTags'
import { useOnline } from '../hooks/useOnline'
import { useUiStore } from '../store/uiStore'
import { formatCurrency, pluralRu } from '../lib/format'
import { colors } from '../theme'
import { PageSearch } from '../components/common/PageSearch'

/** Чеки — receipt cards из реального /api/v1/receipts (новые сверху, «Загрузить ещё»). */
export function DashboardPage() {
    const online = useOnline()
    const [search, setSearch] = useState('')

    const {
        data,
        isLoading,
        isError,
        error,
        refetch,
        hasNextPage,
        fetchNextPage,
        isFetchingNextPage,
    } = useReceipts(search)
    const { data: tags } = useTags()
    const periodKey = useUiStore((s) => s.periodKey)
    const customFrom = useUiStore((s) => s.customFrom)
    const customTo = useUiStore((s) => s.customTo)
    const monthYear = useUiStore((s) => s.monthYear)
    const dayDate = useUiStore((s) => s.dayDate)
    const openAddMenu = useUiStore((s) => s.openAddMenu)

    const tagsMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
    const range = useMemo(() => rangeFor(periodKey, customFrom, customTo, monthYear, dayDate), [periodKey, customFrom, customTo, monthYear, dayDate])

    const receipts = useMemo(() => {
        const all = data?.pages.flatMap((p) => p.items) ?? []
        const q = search.trim().toLowerCase()
        const inRange = all
            .filter((r) => r.datetime.slice(0, 10) >= range.from && r.datetime.slice(0, 10) <= range.to)
            .map(mapReceipt)
        return q
            ? inRange.filter((r) =>
                `${r.store} ${r.items.map((i) => i.name).join(' ')}`.toLowerCase().includes(q),
            )
            : inRange
    }, [data, range, search])

    const totalSpent = receipts.reduce((s, r) => s + (r.isIncome ? 0 : r.total), 0)

    if (isLoading) return <LoadingState label="Загружаем чеки…" />
    if (!online) return <OfflineState onRetry={() => void refetch()} />
    if (isError) return <ErrorState message={error instanceof Error ? error.message : 'Неизвестная ошибка'} onRetry={() => void refetch()} />

    return (
        <Stack spacing={2}>
            <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <PageSearch value={search} onChange={setSearch} placeholder="Поиск по названию чека" ariaLabel="Поиск по названию чеков" width="100%" />
                    </Box>
                    <Button variant="contained" startIcon={<AddIcon />} onClick={openAddMenu} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
                        Добавить
                    </Button>
                </Stack>
                <Typography variant="body2" color="text.secondary">
                    {receipts.length > 0
                        ? `${pluralRu(receipts.length, ['чек', 'чека', 'чеков'])} · расход ${formatCurrency(totalSpent)}`
                        : 'За выбранный период'}
                </Typography>
            </Stack>

            {receipts.length === 0 ? (
                <EmptyState
                    title="Чеков пока нет"
                    subtitle="Отсканируйте чек или добавьте транзакцию"
                    actionLabel="Добавить"
                    onAction={openAddMenu}
                />
            ) : (
                <Box
                    sx={{
                        display: 'grid',
                        gap: { xs: 1.5, sm: 2 },
                        width: '100%',
                        gridTemplateColumns: {
                            xs: 'minmax(0, 1fr)',
                            sm: 'repeat(auto-fill, minmax(240px, 1fr))',
                        },
                    }}
                >
                    {receipts.map((r) => (
                        <ReceiptCard key={r.id} receipt={r} tagsMap={tagsMap} />
                    ))}
                </Box>
            )}

            {hasNextPage && (
                <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    sx={{ alignSelf: 'center', borderColor: 'divider', bgcolor: 'background.paper', color: 'text.primary', mt: 0.5 }}
                >
                    {isFetchingNextPage ? 'Загружаем…' : 'Загрузить ещё'}
                </Button>
            )}
            {receipts.length > 0 && (
                <Typography variant="caption" color={colors.textSecondary} sx={{ textAlign: 'center', py: 1 }}>
                    Показано {pluralRu(receipts.length, ['чек', 'чека', 'чеков'])}
                </Typography>
            )}

        </Stack>
    )
}
