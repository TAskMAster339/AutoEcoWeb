import { useMemo, useState } from 'react'
import {
    Box,
    Button,
    Card,
    Chip,
    Divider,
    IconButton,
    Stack,
    Typography,
    useTheme,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DownloadIcon from '@mui/icons-material/Download'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getReceipt, fetchReceiptRaw } from '../api/receipts'
import { messageFromError } from '../api/client'
import { useTags } from '../hooks/useTags'
import { useDeleteReceipt } from '../hooks/useReceipts'
import { useOnline } from '../hooks/useOnline'
import { LoadingState, ErrorState, OfflineState } from '../components/common/States'
import { TagChip } from '../components/common/TagChip'
import { ConfirmDialog } from '../components/common/ConfirmDialog'
import { isIncomeOperation } from '../api/transactions'
import { displayAlias } from '../lib/aliases'
import { formatCurrency, pluralRu } from '../lib/format'
import { colors } from '../theme'

const OPERATION_LABEL: Record<number, string> = {
    1: 'Приход (покупка)',
    2: 'Расход (возврат)',
    3: 'Возврат прихода',
    4: 'Возврат расхода',
}

/** Формат полной даты и времени из ISO datetime (UTC → локальное поле). */
function formatDateTime(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

/** Скачивание данных как JSON-файла (без сетевого вызова). */
function downloadJson(filename: string, data: unknown) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

/** Подробная страница чека: вся информация + транзакции + скачать raw. */
export function ReceiptDetailPage() {
    const theme = useTheme()
    const navigate = useNavigate()
    const { id } = useParams<{ id: string }>()
    const online = useOnline()
    const { data: tags } = useTags()
    const deleteReceipt = useDeleteReceipt()
    const [deleteOpen, setDeleteOpen] = useState(false)

    const tagsMap = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])

    const receiptQuery = useQuery({
        queryKey: ['receipt', id],
        queryFn: () => getReceipt(id!),
        enabled: Boolean(id),
    })

    const rawQuery = useQuery({
        queryKey: ['receipt-raw', id],
        queryFn: () => fetchReceiptRaw(id!),
        enabled: Boolean(id),
    })

    const receipt = receiptQuery.data
    const isIncome = receipt ? isIncomeOperation(receipt.operation_type) : false

    const downloadRaw = () => {
        const raw = rawQuery.data
        if (!raw) return
        downloadJson(`receipt-${receipt?.receipt_number ?? receipt?.id ?? 'raw'}.json`, raw)
    }

    const confirmDelete = () => {
        if (!id) return
        deleteReceipt.mutate(id, {
            onSuccess: () => navigate('/dashboard', { replace: true }),
        })
    }

    if (!online) return <OfflineState />
    if (receiptQuery.isLoading) return <LoadingState label="Загружаем чек…" />
    if (receiptQuery.isError) {
        return (
            <ErrorState
                message={receiptQuery.error instanceof Error ? receiptQuery.error.message : 'Ошибка загрузки чека'}
                onRetry={() => void receiptQuery.refetch()}
            />
        )
    }
    if (!receipt) return <LoadingState />

    const store = displayAlias(receipt.seller_name_alias_name, receipt.normalized_seller_name, receipt.seller_name)
    const totalPositions = receipt.transactions.length
    const expenseTotal = receipt.transactions.reduce(
        (s, t) => (isIncomeOperation(t.operation_type) ? s : s + Number(t.amount)),
        0,
    )
    const incomeTotal = receipt.transactions.reduce(
        (s, t) => (isIncomeOperation(t.operation_type) ? s + Number(t.amount) : s),
        0,
    )

    return (
        <Stack spacing={2} sx={{ maxWidth: 720, mx: 'auto', width: '100%' }}>
            {/* Верх: назад + заголовок + действия с чеком */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'auto minmax(0, 1fr)', sm: 'auto minmax(0, 1fr) auto' }, alignItems: 'center', gap: 1 }}>
                <IconButton aria-label="Назад" onClick={() => navigate(-1)}>
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h5" sx={{ fontWeight: 700, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {store}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, width: { xs: '100%', sm: 'auto' } }}>
                    <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={downloadRaw}
                        disabled={rawQuery.isLoading || deleteReceipt.isPending}
                        sx={{ borderRadius: '8px', whiteSpace: 'nowrap' }}
                    >
                        {rawQuery.isLoading ? 'Загрузка…' : 'Скачать raw'}
                    </Button>
                    <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => setDeleteOpen(true)}
                        disabled={deleteReceipt.isPending}
                        sx={{ borderRadius: '8px', whiteSpace: 'nowrap' }}
                    >
                        Удалить чек
                    </Button>
                </Stack>
            </Box>

            {/* Сводка */}
            <Card sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                        sx={{
                            width: 56,
                            height: 56,
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 24,
                            fontWeight: 800,
                            color: '#fff',
                            bgcolor: isIncome ? colors.green : colors.primary,
                            flexShrink: 0,
                        }}
                        aria-hidden
                    >
                        {store.charAt(0).toUpperCase()}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 18 }}>{store}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                        <Typography
                            className="tnum"
                            sx={{ fontWeight: 800, fontSize: 20, letterSpacing: '-0.02em', color: isIncome ? colors.green : colors.red }}
                        >
                            {isIncome ? '+' : '−'}
                            {formatCurrency(Math.abs(Number(receipt.total_sum)))}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            {pluralRu(totalPositions, ['позиция', 'позиции', 'позиций'])}
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' },
                        gap: 1.5,
                    }}
                >
                    <InfoField label="Тип операции" value={OPERATION_LABEL[receipt.operation_type] ?? String(receipt.operation_type)} />
                    <InfoField label="Номер чека" value={receipt.receipt_number ?? '—'} />
                    <InfoField label="ИНН продавца" value={receipt.seller_inn ?? '—'} />
                    <InfoField label="Кешбэк" value={receipt.cashback !== null && receipt.cashback !== undefined ? formatCurrency(Number(receipt.cashback)) : '—'} />
                    <InfoField label="Остаток после" value={receipt.balance_after !== null && receipt.balance_after !== undefined ? formatCurrency(Number(receipt.balance_after)) : '—'} />
                    <InfoField label="Создан" value={formatDateTime(receipt.created_at)} />
                </Box>

                {receipt.qr && (
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            QR
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                fontFamily: 'monospace',
                                wordBreak: 'break-all',
                                p: 1.25,
                                borderRadius: '8px',
                                bgcolor: theme.palette.mode === 'dark' ? '#101016' : colors.bg,
                                color: 'text.secondary',
                                fontSize: 12,
                            }}
                        >
                            {receipt.qr}
                        </Typography>
                    </Box>
                )}
            </Card>

            {/* Итоги */}
            <Card sx={{ p: 2.5 }}>
                <Stack direction="row" spacing={2} sx={{ width: '100%' }}>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Расходы
                        </Typography>
                        <Typography className="tnum" sx={{ fontWeight: 700, color: colors.red }}>
                            −{formatCurrency(expenseTotal)}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Доходы
                        </Typography>
                        <Typography className="tnum" sx={{ fontWeight: 700, color: colors.green }}>
                            +{formatCurrency(incomeTotal)}
                        </Typography>
                    </Box>
                    <Box sx={{ flex: 1, textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Итого
                        </Typography>
                        <Typography
                            className="tnum"
                            sx={{ fontWeight: 800, color: isIncome ? colors.green : colors.red }}
                        >
                            {isIncome ? '+' : '−'}
                            {formatCurrency(Math.abs(Number(receipt.total_sum)))}
                        </Typography>
                    </Box>
                </Stack>
            </Card>

            {/* Позиции */}
            <Card sx={{ p: 2.5 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
                    Позиции
                </Typography>
                {receipt.transactions.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        В чеке нет позиций.
                    </Typography>
                ) : (
                    <Stack spacing={1.25} divider={<Divider flexItem />}>
                        {receipt.transactions.map((t) => {
                            const txIncome = isIncomeOperation(t.operation_type)
                            const tag = t.tag_id ? tagsMap.get(t.tag_id) : undefined
                            return (
                                <Box key={t.id ?? `${t.name}-${t.datetime}`}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                {displayAlias(t.name_alias_name, t.normalized_name, t.name)}
                                            </Typography>
                                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.25, flexWrap: 'wrap' }}>
                                                {t.quantity !== null && t.quantity !== undefined && (
                                                    <Chip size="small" label={`×${t.quantity}`} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                                                )}
                                                {t.price !== null && t.price !== undefined && (
                                                    <Chip size="small" label={formatCurrency(Number(t.price))} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                                                )}
                                                {tag && <TagChip tag={tag} />}
                                                {t.comment && (
                                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                                                        {t.comment}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                        <Typography
                                            className="tnum"
                                            variant="body2"
                                            sx={{ fontWeight: 700, color: txIncome ? colors.green : colors.red }}
                                        >
                                            {txIncome ? '+' : '−'}
                                            {formatCurrency(Math.abs(Number(t.amount)))}
                                        </Typography>
                                    </Box>
                                </Box>
                            )
                        })}
                    </Stack>
                )}
            </Card>

            <ConfirmDialog
                open={deleteOpen}
                title="Удалить чек?"
                message={
                    <>
                        Чек магазина <strong>{store}</strong> и все его {pluralRu(totalPositions, ['транзакция', 'транзакции', 'транзакций'])} будут удалены безвозвратно.
                    </>
                }
                confirmLabel="Удалить чек"
                pending={deleteReceipt.isPending}
                error={deleteReceipt.isError ? messageFromError(deleteReceipt.error) : null}
                onConfirm={confirmDelete}
                onClose={() => setDeleteOpen(false)}
            />
        </Stack>
    )
}

function InfoField({ label, value }: { label: string; value: string }) {
    return (
        <Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.25 }}>
                {value}
            </Typography>
        </Box>
    )
}
