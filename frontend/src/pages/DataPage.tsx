import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
    Alert,
    Box,
    Button,
    Card,
    Checkbox,
    Chip,
    CircularProgress,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material'
import { useQueryClient } from '@tanstack/react-query'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined'
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import {
    downloadExport,
    previewImport,
    runImport,
    type ImportPreview,
    type ImportResult,
    type ImportRowPreview,
    type ExportLayout,
} from '../api/importExport'
import { messageFromError } from '../api/client'
import { colors, softBg, softFg } from '../theme'

const FORMAT_COLUMNS = 'Дата, категория, магазин, описание, количество, единица, цена, комментарий, доход и расход'

function formatDate(iso: string | null): string {
    if (!iso) return '—'
    const [year, month, day] = iso.split('-')
    return `${day}.${month}.${year}`
}

function formatMoney(value: string): string {
    const number = Number(value)
    if (!Number.isFinite(number)) return '—'
    return `${number.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
}

function rowAmount(row: ImportRowPreview): { value: string; income: boolean } {
    const income = row.operation_kind === 'income'
    const amount = formatMoney(income ? row.income : row.expense)
    return { value: amount === '—' ? amount : `${income ? '+' : '−'}${amount}`, income }
}

type Stage = 'idle' | 'uploading' | 'preview' | 'importing' | 'done' | 'error'

export function DataPage() {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [stage, setStage] = useState<Stage>('idle')
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<ImportPreview | null>(null)
    const [selected, setSelected] = useState<ReadonlySet<number>>(new Set())
    const [result, setResult] = useState<ImportResult | null>(null)
    const [exporting, setExporting] = useState(false)
    const [exportLayout, setExportLayout] = useState<ExportLayout>('monthly')

    const pickFile = () => fileInputRef.current?.click()

    const handleFile = async (file: File | undefined) => {
        if (!file) return
        setStage('uploading')
        setError(null)
        setResult(null)
        setPreview(null)
        setSelected(new Set())
        try {
            const nextPreview = await previewImport(file)
            setPreview(nextPreview)
            setSelected(new Set(nextPreview.rows.filter((row) => row.errors.length === 0).map((row) => row.row_number)))
            setStage('preview')
        } catch (caught) {
            setError(messageFromError(caught))
            setStage('error')
        }
    }

    const toggleRow = (index: number) => {
        setSelected((previous) => {
            const next = new Set(previous)
            if (next.has(index)) next.delete(index)
            else next.add(index)
            return next
        })
    }

    const handleImport = async () => {
        if (!preview || selected.size === 0) return
        const rows = preview.rows
            .filter((row) => selected.has(row.row_number))
            .map((row) => ({
                date: row.date ?? '',
                category: row.category,
                store: row.store,
                description: row.description,
                quantity: row.quantity,
                unit: row.unit,
                price: row.price,
                comment: row.comment,
                income: row.income,
                expense: row.expense,
                operation_kind: row.operation_kind,
            }))
        setStage('importing')
        setError(null)
        try {
            const importResult = await runImport(rows)
            setResult(importResult)
            setStage('done')
            void queryClient.invalidateQueries({ queryKey: ['transactions'] })
            void queryClient.invalidateQueries({ queryKey: ['summary'] })
            void queryClient.invalidateQueries({ queryKey: ['analytics'] })
            void queryClient.invalidateQueries({ queryKey: ['tags'] })
            void queryClient.invalidateQueries({ queryKey: ['receipts'] })
        } catch (caught) {
            setError(messageFromError(caught))
            setStage('error')
        }
    }

    const reset = () => {
        setStage('idle')
        setError(null)
        setPreview(null)
        setResult(null)
        setSelected(new Set())
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    const handleExport = async () => {
        setExporting(true)
        setError(null)
        try {
            await downloadExport(exportLayout)
        } catch (caught) {
            setError(messageFromError(caught))
        } finally {
            setExporting(false)
        }
    }

    const fileBusy = stage === 'uploading' || stage === 'importing'

    return (
        <Stack spacing={2} sx={{ width: '100%', maxWidth: 1180, mx: 'auto' }}>
            <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                hidden
                onChange={(event) => void handleFile(event.target.files?.[0])}
            />

            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
                    gap: 2,
                }}
            >
                <DataActionCard
                    icon={<FileUploadOutlinedIcon />}
                    eyebrow="Загрузка данных"
                    title="Импорт"
                    description="Загрузите таблицу, проверьте строки в предпросмотре и выберите, какие данные сохранить. Новые теги создадутся автоматически."
                    details={['Поддерживаются .xlsx и .csv', FORMAT_COLUMNS, 'Перед записью доступна проверка ошибок']}
                    action={
                        <Button
                            fullWidth
                            variant="contained"
                            startIcon={fileBusy ? <CircularProgress size={18} color="inherit" /> : <FileUploadOutlinedIcon />}
                            onClick={pickFile}
                            disabled={fileBusy}
                        >
                            {stage === 'uploading' ? 'Разбираем файл…' : preview ? 'Выбрать другой файл' : 'Выбрать файл'}
                        </Button>
                    }
                />
                <DataActionCard
                    icon={<DownloadOutlinedIcon />}
                    eyebrow="Выгрузка данных"
                    title="Экспорт"
                    description="Скачайте все транзакции в одном Excel-файле и выберите удобную структуру листов. Файл останется готов для повторного импорта."
                    details={['Формат .xlsx', 'Один общий лист или лист на каждый месяц', FORMAT_COLUMNS]}
                    action={
                        <Stack spacing={1.25}>
                            <Stack direction="row" spacing={1}>
                                <Button fullWidth size="small" variant={exportLayout === 'single' ? 'contained' : 'outlined'} onClick={() => setExportLayout('single')} disabled={exporting}>
                                    Один лист
                                </Button>
                                <Button fullWidth size="small" variant={exportLayout === 'monthly' ? 'contained' : 'outlined'} onClick={() => setExportLayout('monthly')} disabled={exporting}>
                                    По месяцам
                                </Button>
                            </Stack>
                            <Button
                                fullWidth
                                variant="outlined"
                                startIcon={exporting ? <CircularProgress size={18} color="inherit" /> : <DownloadOutlinedIcon />}
                                onClick={() => void handleExport()}
                                disabled={exporting}
                            >
                                {exporting ? 'Готовим файл…' : 'Скачать .xlsx'}
                            </Button>
                        </Stack>
                    }
                />
            </Box>

            {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

            <Card sx={{ overflow: 'hidden' }}>
                <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2, borderBottom: preview ? '1px solid' : 0, borderColor: 'divider' }}>
                    <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Предпросмотр таблицы</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                        Фильтрация и поиск в этом блоке выполняются только на устройстве.
                    </Typography>
                </Box>

                {!preview ? (
                    <TablePlaceholder loading={stage === 'uploading'} onPickFile={pickFile} />
                ) : (
                    <PreviewBlock
                        preview={preview}
                        selected={selected}
                        result={result}
                        importing={stage === 'importing'}
                        onToggle={toggleRow}
                        onImport={() => void handleImport()}
                        onReset={reset}
                    />
                )}
            </Card>
        </Stack>
    )
}

function DataActionCard({
    icon,
    eyebrow,
    title,
    description,
    details,
    action,
}: {
    icon: React.ReactNode
    eyebrow: string
    title: string
    description: string
    details: string[]
    action: React.ReactNode
}) {
    const theme = useTheme()
    return (
        <Card
            sx={{
                p: { xs: 2.25, sm: 3 },
                aspectRatio: { md: '1 / 1' },
                minHeight: { xs: 330, md: 0 },
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <Box
                sx={{
                    width: 52,
                    height: 52,
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '8px',
                    bgcolor: softBg(theme),
                    color: softFg(theme),
                    '& svg': { fontSize: 28 },
                }}
            >
                {icon}
            </Box>
            <Typography variant="overline" color="primary" sx={{ fontWeight: 700, mt: 2.5, lineHeight: 1.4 }}>
                {eyebrow}
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.5 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.7 }}>
                {description}
            </Typography>
            <Stack spacing={0.9} sx={{ mt: 2 }}>
                {details.map((detail) => (
                    <Stack key={detail} direction="row" spacing={1} alignItems="flex-start">
                        <CheckCircleOutlineIcon color="primary" sx={{ fontSize: 17, mt: '2px', flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary">{detail}</Typography>
                    </Stack>
                ))}
            </Stack>
            <Box sx={{ mt: 'auto', pt: 3 }}>{action}</Box>
        </Card>
    )
}

function TablePlaceholder({ loading, onPickFile }: { loading: boolean; onPickFile: () => void }) {
    return (
        <Stack
            alignItems="center"
            justifyContent="center"
            spacing={1.5}
            sx={{ minHeight: { xs: 280, sm: 340 }, px: 2, py: 5, textAlign: 'center' }}
        >
            {loading ? <CircularProgress size={32} /> : <DescriptionOutlinedIcon sx={{ fontSize: 54, color: 'text.disabled' }} />}
            <Box>
                <Typography sx={{ fontWeight: 700 }}>{loading ? 'Разбираем таблицу…' : 'Таблица ещё не загружена'}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {loading ? 'Это может занять несколько секунд' : 'Выберите файл импорта — его строки появятся здесь до сохранения'}
                </Typography>
            </Box>
            {!loading && <Button variant="text" startIcon={<FileUploadOutlinedIcon />} onClick={onPickFile}>Выбрать файл</Button>}
        </Stack>
    )
}

type RowFilter = 'all' | 'valid' | 'invalid'

function PreviewBlock({
    preview,
    selected,
    result,
    importing,
    onToggle,
    onImport,
    onReset,
}: {
    preview: ImportPreview
    selected: ReadonlySet<number>
    result: ImportResult | null
    importing: boolean
    onToggle: (index: number) => void
    onImport: () => void
    onReset: () => void
}) {
    const theme = useTheme()
    const desktopTable = useMediaQuery(theme.breakpoints.up('sm'))
    const rowRefs = useRef(new Map<number, HTMLElement>())
    const [filter, setFilter] = useState<RowFilter>('all')
    const [search, setSearch] = useState('')
    const deferredSearch = useDeferredValue(search)
    const [activeError, setActiveError] = useState(0)
    const [page, setPage] = useState(0)
    const rowsPerPage = 100
    const errorRows = useMemo(() => preview.rows.filter((row) => row.errors.length > 0), [preview.rows])
    const query = deferredSearch.trim().toLocaleLowerCase()
    const visibleRows = useMemo(() => preview.rows.filter((row) => {
        if (filter === 'valid' && row.errors.length > 0) return false
        if (filter === 'invalid' && row.errors.length === 0) return false
        if (!query) return true
        return [row.date, row.category, row.store, row.description, row.quantity, row.unit, row.price, row.comment, row.income, row.expense, ...row.errors]
            .some((value) => String(value ?? '').toLocaleLowerCase().includes(query))
    }), [filter, preview.rows, query])
    const pagedRows = useMemo(
        () => visibleRows.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
        [page, visibleRows],
    )

    useEffect(() => {
        const lastPage = Math.max(0, Math.ceil(visibleRows.length / rowsPerPage) - 1)
        if (page > lastPage) setPage(lastPage)
    }, [page, visibleRows.length])

    useEffect(() => {
        if (filter !== 'invalid' || query) return
        const target = errorRows[activeError]
        if (!target) return
        const frame = window.requestAnimationFrame(() => {
            rowRefs.current.get(target.row_number)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        })
        return () => window.cancelAnimationFrame(frame)
    }, [activeError, errorRows, filter, page, query])

    const goToError = (direction: -1 | 1) => {
        if (errorRows.length === 0) return
        const next = (activeError + direction + errorRows.length) % errorRows.length
        const target = errorRows[next]
        if (!target) return
        setActiveError(next)
        setFilter('invalid')
        setSearch('')
        setPage(Math.floor(next / rowsPerPage))
    }

    const showErrors = () => {
        setFilter('invalid')
        setSearch('')
        setPage(0)
        const firstError = errorRows[0]
        if (firstError) {
            setActiveError(0)
        }
    }

    return (
        <Stack>
            {result && <ImportResultBanner result={result} />}
            <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1.25}
                sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: '1px solid', borderColor: 'divider' }}
            >
                <TextField
                    value={search}
                    onChange={(event) => { setSearch(event.target.value); setPage(0) }}
                    placeholder="Найти строку"
                    aria-label="Поиск по загруженной таблице"
                    slotProps={{ input: { startAdornment: <SearchOutlinedIcon sx={{ mr: 1, fontSize: 20, color: 'text.secondary' }} /> } }}
                    sx={{ flex: 1, minWidth: 0 }}
                />
                <Stack direction="row" spacing={0.75} sx={{ overflowX: 'auto', pb: 0.25 }}>
                    <FilterButton active={filter === 'all'} onClick={() => { setFilter('all'); setPage(0) }}>Все {preview.total}</FilterButton>
                    <FilterButton active={filter === 'valid'} onClick={() => { setFilter('valid'); setPage(0) }}>Без ошибок {preview.valid}</FilterButton>
                    <FilterButton active={filter === 'invalid'} error onClick={showErrors}>С ошибками {preview.invalid}</FilterButton>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.25} sx={{ flexShrink: 0 }}>
                    <IconButton size="small" aria-label="Предыдущая строка с ошибкой" disabled={errorRows.length === 0} onClick={() => goToError(-1)}>
                        <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                    <Typography variant="caption" sx={{ minWidth: 76, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                        {errorRows.length === 0 ? '0 / 0 ошибок' : `${activeError + 1} / ${errorRows.length} ошибок`}
                    </Typography>
                    <IconButton size="small" aria-label="Следующая строка с ошибкой" disabled={errorRows.length === 0} onClick={() => goToError(1)}>
                        <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                </Stack>
            </Stack>

            {visibleRows.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 260, p: 3, textAlign: 'center' }}>
                    <Typography sx={{ fontWeight: 700 }}>Строки не найдены</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Измените фильтр или поисковый запрос</Typography>
                </Stack>
            ) : (
                <>
                    {desktopTable ? <TableContainer sx={{ maxHeight: 460 }}>
                        <Table stickyHeader size="small" aria-label="Предпросмотр импортируемых строк">
                            <TableHead sx={{ '& th': { bgcolor: 'background.paper', fontWeight: 700, whiteSpace: 'nowrap' } }}>
                                <TableRow>
                                    <TableCell padding="checkbox" />
                                    <TableCell>Дата</TableCell>
                                    <TableCell>Описание</TableCell>
                                    <TableCell>Тег</TableCell>
                                    <TableCell>Магазин</TableCell>
                                    <TableCell align="right">Сумма</TableCell>
                                    <TableCell>Проверка</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {pagedRows.map((row) => (
                                    <PreviewTableRow
                                        key={row.row_number}
                                        row={row}
                                        checked={selected.has(row.row_number)}
                                        highlighted={errorRows[activeError]?.row_number === row.row_number && filter === 'invalid'}
                                        onToggle={() => onToggle(row.row_number)}
                                        setRef={(element) => element ? rowRefs.current.set(row.row_number, element) : rowRefs.current.delete(row.row_number)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer> : <Stack spacing={1} sx={{ p: 1.5, maxHeight: 520, overflowY: 'auto' }}>
                        {pagedRows.map((row) => (
                            <PreviewMobileRow
                                key={row.row_number}
                                row={row}
                                checked={selected.has(row.row_number)}
                                highlighted={errorRows[activeError]?.row_number === row.row_number && filter === 'invalid'}
                                onToggle={() => onToggle(row.row_number)}
                                setRef={(element) => element ? rowRefs.current.set(row.row_number, element) : rowRefs.current.delete(row.row_number)}
                            />
                        ))}
                    </Stack>}
                    <TablePagination
                        component="div"
                        count={visibleRows.length}
                        page={page}
                        onPageChange={(_, nextPage) => setPage(nextPage)}
                        rowsPerPage={rowsPerPage}
                        rowsPerPageOptions={[rowsPerPage]}
                        labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`}
                        labelRowsPerPage="Строк на странице:"
                    />
                </>
            )}

            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
                justifyContent="space-between"
                spacing={1.25}
                sx={{ p: { xs: 1.5, sm: 2 }, borderTop: '1px solid', borderColor: 'divider' }}
            >
                <Typography variant="body2" color="text.secondary">
                    Выбрано для импорта: <Box component="span" sx={{ color: 'text.primary', fontWeight: 700 }}>{selected.size}</Box>
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Button fullWidth={false} variant="text" onClick={onReset} disabled={importing}>Очистить</Button>
                    <Button
                        fullWidth
                        variant="contained"
                        disabled={selected.size === 0 || importing || result !== null}
                        onClick={onImport}
                        startIcon={importing ? <CircularProgress size={18} color="inherit" /> : undefined}
                    >
                        {result ? 'Импорт завершён' : importing ? 'Импортируем…' : `Импортировать (${selected.size})`}
                    </Button>
                </Stack>
            </Stack>
        </Stack>
    )
}

function FilterButton({ active, error = false, onClick, children }: {
    active: boolean
    error?: boolean
    onClick: () => void
    children: React.ReactNode
}) {
    return (
        <Button
            size="small"
            variant={active ? 'contained' : 'outlined'}
            color={error && active ? 'error' : 'primary'}
            onClick={onClick}
            sx={{ flexShrink: 0, whiteSpace: 'nowrap', boxShadow: 'none' }}
        >
            {children}
        </Button>
    )
}

function PreviewTableRow({ row, checked, highlighted, onToggle, setRef }: {
    row: ImportRowPreview
    checked: boolean
    highlighted: boolean
    onToggle: () => void
    setRef: (element: HTMLTableRowElement | null) => void
}) {
    const theme = useTheme()
    const hasErrors = row.errors.length > 0
    const amount = rowAmount(row)
    return (
        <TableRow
            ref={setRef}
            selected={highlighted}
            sx={{
                bgcolor: hasErrors ? (theme.palette.mode === 'dark' ? 'rgba(220,38,38,0.12)' : colors.redSoft) : undefined,
                '&.Mui-selected, &.Mui-selected:hover': { bgcolor: hasErrors ? 'rgba(220, 38, 38, 0.2)' : undefined },
                '& td': { borderColor: 'divider', verticalAlign: 'top' },
            }}
        >
            <TableCell padding="checkbox"><Checkbox checked={checked} onChange={onToggle} size="small" /></TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(row.date)}</TableCell>
            <TableCell sx={{ minWidth: 180, maxWidth: 320 }}><Typography variant="body2">{row.description || '—'}</Typography></TableCell>
            <TableCell>{row.category ? <Chip label={row.category} size="small" /> : '—'}</TableCell>
            <TableCell>{row.store || '—'}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 700, color: amount.income ? colors.green : 'text.primary' }}>{amount.value}</TableCell>
            <TableCell sx={{ minWidth: 180 }}>
                {hasErrors
                    ? <Typography variant="caption" sx={{ color: colors.red }}>{row.errors.join('; ')}</Typography>
                    : <Typography variant="caption" sx={{ color: colors.green, fontWeight: 600 }}>Готово к импорту</Typography>}
            </TableCell>
        </TableRow>
    )
}

function PreviewMobileRow({ row, checked, highlighted, onToggle, setRef }: {
    row: ImportRowPreview
    checked: boolean
    highlighted: boolean
    onToggle: () => void
    setRef: (element: HTMLDivElement | null) => void
}) {
    const theme = useTheme()
    const hasErrors = row.errors.length > 0
    const amount = rowAmount(row)
    return (
        <Box
            ref={setRef}
            component="label"
            sx={{
                p: 1.25,
                border: '1px solid',
                borderColor: highlighted ? 'error.main' : 'divider',
                borderRadius: '8px',
                bgcolor: hasErrors ? (theme.palette.mode === 'dark' ? 'rgba(220,38,38,0.12)' : colors.redSoft) : 'background.paper',
                boxShadow: highlighted ? `0 0 0 2px ${theme.palette.error.main}22` : 'none',
            }}
        >
            <Stack direction="row" spacing={1} alignItems="flex-start">
                <Checkbox checked={checked} onChange={onToggle} size="small" sx={{ p: 0.25 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                        <Typography variant="caption" sx={{ fontWeight: 700 }}>{formatDate(row.date)}</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: amount.income ? colors.green : 'text.primary' }}>{amount.value}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: 'anywhere' }}>{row.description || '—'}</Typography>
                    <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                        {row.category && <Chip label={row.category} size="small" />}
                        {row.store && <Chip label={row.store} size="small" variant="outlined" />}
                    </Stack>
                    {hasErrors
                        ? <Typography variant="caption" sx={{ display: 'block', color: colors.red, mt: 1 }}>{row.errors.join('; ')}</Typography>
                        : <Typography variant="caption" sx={{ display: 'block', color: colors.green, fontWeight: 600, mt: 1 }}>Готово к импорту</Typography>}
                </Box>
            </Stack>
        </Box>
    )
}

function ImportResultBanner({ result }: { result: ImportResult }) {
    const theme = useTheme()
    return (
        <Stack spacing={1} sx={{ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(22,163,74,0.12)' : colors.greenSoft, borderBottom: '1px solid', borderColor: 'divider' }} role="status">
            <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleOutlineIcon sx={{ color: colors.green }} />
                <Typography sx={{ color: colors.green, fontWeight: 700 }}>Импортировано транзакций: {result.imported}</Typography>
            </Stack>
            {result.tags_created.length > 0 && (
                <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">Созданы теги:</Typography>
                    {result.tags_created.map((name) => <Chip key={name} label={name} size="small" />)}
                </Stack>
            )}
            {result.errors.length > 0 && <Typography variant="caption" color="error">Пропущено строк: {result.errors.length}</Typography>}
        </Stack>
    )
}