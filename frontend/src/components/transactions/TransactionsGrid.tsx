import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import type { CellContextMenuEvent, ColDef, IDatasource, IGetRowsParams, RowClickedEvent } from 'ag-grid-community'
import { Alert, Box, Button, CircularProgress, MenuItem, Paper, Popper, Select, Stack, Typography, useTheme } from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatNumber, formatShortDate } from '../../lib/format'
import { colors } from '../../theme'
import {
  fetchTransactionsPage,
  toTransactionView,
  type TransactionsPageParams,
} from '../../api/transactions'
import type { Tag, TransactionView } from '../../api/types'
import { medianOf, replaceQuickEditTarget, selectionRange } from '../../lib/transactionInteractions.mjs'
import {
  QuickEditPopover,
  type QuickEditField,
  type QuickEditTarget,
} from './QuickEditPopover'

interface GridContext {
  tagsMap: Map<string, Tag>
}

/** Russian locale for the grid internals (empty state, a11y labels). */
const RU_LOCALE = {
  noRowsToShow: 'Нет данных',
  loadingOoo: 'Загрузка…',
}

function TagsCell(props: CustomCellRendererProps<TransactionView, string | null>) {
  const ctx = props.context as GridContext
  const tag = props.value ? ctx.tagsMap.get(props.value) : undefined
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
      {tag ? (
        <TagChip key={tag.id} tag={tag} size="compact" />
      ) : (
        <Typography component="span" sx={{ color: 'text.secondary' }}>
          –
        </Typography>
      )}
    </Box>
  )
}

const rightAligned: Partial<ColDef<TransactionView>> = {
  type: 'rightAligned',
  headerClass: 'ag-right-aligned-header',
}

/**
 * Минимальная ширина колонки: колонку нельзя сузить настолько, чтобы
 * заголовок начал обрезаться. Кириллица в Inter 14px/600 занимает
 * ~8.4px на символ + 12px отступы с каждой стороны ячейки.
 */
function headerMinWidth(headerName: string): number {
  return Math.ceil(headerName.length * 8.4) + 24
}

type StatsColumnId = keyof Pick<
  TransactionView,
  'date' | 'store' | 'tagId' | 'name' | 'quantity' | 'price' | 'income' | 'expense' | 'balance' | 'comment'
>

interface NumericColumnStats {
  kind: 'numeric'
  count: number
  empty: number
  sum: number
  min: number | null
  max: number | null
  values: number[]
}

interface CategoryColumnStats {
  kind: 'category'
  count: number
  empty: number
  unique: Set<string>
  frequencies: Map<string, number>
  topValue: string | null
  topCount: number
}

type ColumnStats = NumericColumnStats | CategoryColumnStats

interface StatsAccumulator {
  rowIds: Set<string>
  columns: Record<StatsColumnId, ColumnStats>
}

interface StatsTarget {
  anchor: HTMLElement
  field: StatsColumnId
}

const NUMERIC_COLUMNS = new Set<StatsColumnId>(['quantity', 'price', 'income', 'expense', 'balance'])
const QUICK_EDIT_FIELDS = new Set<QuickEditField>([
  'date',
  'store',
  'tagId',
  'name',
  'quantity',
  'price',
  'income',
  'expense',
  'comment',
])

function createStatsAccumulator(): StatsAccumulator {
  const columns = {} as Record<StatsColumnId, ColumnStats>
  for (const field of ['date', 'store', 'tagId', 'name', 'quantity', 'price', 'income', 'expense', 'balance', 'comment'] as StatsColumnId[]) {
    columns[field] = NUMERIC_COLUMNS.has(field)
      ? { kind: 'numeric', count: 0, empty: 0, sum: 0, min: null, max: null, values: [] }
      : { kind: 'category', count: 0, empty: 0, unique: new Set(), frequencies: new Map(), topValue: null, topCount: 0 }
  }
  return { rowIds: new Set(), columns }
}

function addRowsToStats(accumulator: StatsAccumulator, rows: TransactionView[]): boolean {
  let changed = false
  for (const row of rows) {
    if (accumulator.rowIds.has(row.id)) continue
    accumulator.rowIds.add(row.id)
    changed = true

    for (const field of Object.keys(accumulator.columns) as StatsColumnId[]) {
      const stats = accumulator.columns[field]
      const rawValue = row[field]
      if (stats.kind === 'numeric') {
        if (typeof rawValue !== 'number' || !Number.isFinite(rawValue)) {
          stats.empty += 1
          continue
        }
        stats.count += 1
        stats.sum += rawValue
        stats.values.push(rawValue)
        stats.min = stats.min === null ? rawValue : Math.min(stats.min, rawValue)
        stats.max = stats.max === null ? rawValue : Math.max(stats.max, rawValue)
        continue
      }

      const value = rawValue === null || rawValue === undefined || rawValue === '' ? null : String(rawValue)
      if (value === null) {
        stats.empty += 1
        continue
      }
      stats.count += 1
      stats.unique.add(value)
      const nextCount = (stats.frequencies.get(value) ?? 0) + 1
      stats.frequencies.set(value, nextCount)
      if (nextCount > stats.topCount) {
        stats.topValue = value
        stats.topCount = nextCount
      }
    }
  }
  return changed
}

function categoryLabel(field: StatsColumnId, value: string | null, tagsMap: Map<string, Tag>): string {
  if (value === null) return '—'
  if (field === 'tagId') return tagsMap.get(value)?.name ?? 'Удалённый тег'
  if (field === 'date') return formatShortDate(value)
  return value
}

function ColumnStatsPopover({
  anchorEl,
  field,
  stats,
  loaded,
  total,
  tagsMap,
  loadingAll,
  loadAllError,
  onLoadAll,
  onClose,
  onMouseEnter,
}: {
  anchorEl: HTMLElement | null
  field: StatsColumnId | null
  stats: ColumnStats | null
  loaded: number
  total: number | null
  tagsMap: Map<string, Tag>
  loadingAll: boolean
  loadAllError: string | null
  onLoadAll: () => void
  onClose: () => void
  onMouseEnter: () => void
}) {
  if (!anchorEl || !field || !stats) return null
  const isCurrency = ['price', 'income', 'expense', 'balance'].includes(field)
  const formatValue = (value: number | null) => isCurrency ? formatCurrency(value) : formatNumber(value)
  const median = stats.kind === 'numeric' ? medianOf(stats.values) : null
  const exact = total !== null && loaded >= total

  return (
    <Popper
      open
      anchorEl={anchorEl}
      placement="bottom-start"
      data-column-stats-popover
      onMouseEnter={onMouseEnter}
      onMouseLeave={onClose}
      sx={{ zIndex: 20 }}
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
    >
      <Paper
        role="tooltip"
        elevation={8}
        sx={{ width: 246, p: 1.5, borderRadius: '8px', border: '1px solid', borderColor: 'divider' }}
      >
        <Typography variant="subtitle2" sx={{ mb: 0.25 }}>Статистика столбца</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25 }}>
          {exact ? `По всем данным: ${loaded}` : `По загруженным: ${loaded}${total !== null ? ` из ${total}` : ''}`}
        </Typography>
        {loaded === 0 ? (
          <Typography variant="body2" color="text.secondary">Данные ещё загружаются</Typography>
        ) : stats.kind === 'numeric' ? (
          <Stack spacing={0.75}>
            <StatsLine label="Значений" value={formatNumber(stats.count)} />
            <StatsLine label="Пустых" value={formatNumber(stats.empty)} />
            <StatsLine label="Сумма" value={stats.count ? formatValue(stats.sum) : '—'} />
            <StatsLine label="Среднее" value={stats.count ? formatValue(stats.sum / stats.count) : '—'} />
            <StatsLine label="Медиана" value={formatValue(median)} />
            <StatsLine label="Минимум" value={formatValue(stats.min)} />
            <StatsLine label="Максимум" value={formatValue(stats.max)} />
          </Stack>
        ) : (
          <Stack spacing={0.75}>
            <StatsLine label="Значений" value={formatNumber(stats.count)} />
            <StatsLine label="Уникальных" value={formatNumber(stats.unique.size)} />
            <StatsLine label="Чаще всего" value={categoryLabel(field, stats.topValue, tagsMap)} />
            <StatsLine label="Встречается" value={stats.topValue === null ? '—' : formatNumber(stats.topCount)} />
            <StatsLine label="Пустых" value={formatNumber(stats.empty)} />
          </Stack>
        )}
        {loadAllError && <Alert severity="error" sx={{ mt: 1.25 }}>{loadAllError}</Alert>}
        {!exact && total !== null && total > 0 && (
          <Button
            size="small"
            fullWidth
            variant="outlined"
            sx={{ mt: 1.25 }}
            disabled={loadingAll}
            onClick={onLoadAll}
            startIcon={loadingAll ? <CircularProgress size={14} /> : undefined}
          >
            {loadingAll ? 'Загружаем все…' : 'Загрузить всё для точной статистики'}
          </Button>
        )}
      </Paper>
    </Popper>
  )
}

function StatsLine({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', gap: 1.5, alignItems: 'baseline' }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" className="tnum" noWrap sx={{ textAlign: 'right', fontWeight: 600 }}>{value}</Typography>
    </Box>
  )
}

const columnDefs: ColDef<TransactionView>[] = [
  {
    field: 'date',
    headerName: 'Дата',
    width: 100,
    minWidth: 100,
    valueFormatter: (p) => formatShortDate(p.value),
  },
  {
    field: 'store',
    headerName: 'Магазин',
    width: 108,
    minWidth: headerMinWidth('Магазин'),
    cellStyle: { fontWeight: 600 },
    valueFormatter: (p) => p.value ?? '—',
  },
  {
    field: 'tagId',
    headerName: 'Теги',
    width: 164,
    minWidth: 140,
    sortable: false, // тег фильтруется на бэке, сортировка по нему не имеет смысла
    cellRenderer: TagsCell,
    valueGetter: (p) => p.data?.tagId ?? null,
  },
  {
    field: 'name',
    headerName: 'Название',
    flex: 1,
    // Бесконечный скролл (infinite row model) не поддерживает autoHeight —
    // фиксированная высота строки, длинный текст обрезается с многоточием.
    minWidth: 220,
  },
  {
    field: 'quantity',
    headerName: 'Кол-во',
    width: 76,
    minWidth: headerMinWidth('Кол-во'),
    ...rightAligned,
    valueFormatter: (p) => formatNumber(p.value),
  },
  {
    field: 'price',
    headerName: 'Цена',
    width: 92,
    minWidth: headerMinWidth('Цена'),
    ...rightAligned,
    valueFormatter: (p) => formatCurrency(p.value),
  },
  {
    field: 'income',
    headerName: 'Доход',
    width: 104,
    minWidth: headerMinWidth('Доход'),
    ...rightAligned,
    cellStyle: { color: 'var(--ag-income-color, #16A34A)', fontWeight: 600 },
    valueFormatter: (p) => formatCurrency(p.value),
  },
  {
    field: 'expense',
    headerName: 'Расход',
    width: 104,
    minWidth: headerMinWidth('Расход'),
    ...rightAligned,
    cellStyle: { color: 'var(--ag-expense-color, #DC2626)', fontWeight: 600 },
    valueFormatter: (p) => formatCurrency(p.value),
  },
  {
    field: 'balance',
    headerName: 'Баланс',
    width: 112,
    minWidth: headerMinWidth('Баланс'),
    ...rightAligned,
    valueFormatter: (p) => formatCurrency(p.value),
  },
  {
    field: 'comment',
    headerName: 'Комментарий',
    flex: 1.2,
    // Бесконечный скролл не поддерживает autoHeight — фиксированная высота.
    minWidth: Math.max(120, headerMinWidth('Комментарий')),
    valueFormatter: (p) => p.value || '—',
    cellStyle: (p) =>
      p.value ? undefined : { color: 'var(--ag-secondary-foreground-color, #9ca3af)' },
  },
]

interface TransactionsGridProps {
  /** Серверные фильтры (период/тег/поиск/магазин) — смена перезагружает таблицу. */
  params: TransactionsPageParams
  tagsMap: Map<string, Tag>
  /** Общее число строк с текущими фильтрами (для пустых состояний страницы). */
  total: number | null
  onTotalChange: (total: number) => void
  /** Выбранные строки (по чекбоксам) — живой список, вызывается при изменении. */
  onSelectionChange?: (ids: string[]) => void
  /** Изменение значения снимает внутреннее выделение AG Grid. */
  selectionResetRevision?: number
  /** Двойной клик по строке — редактирование. */
  onEdit?: (tx: TransactionView) => void
}

/**
 * Desktop data table (AG Grid) на Infinite Row Model: блоки строк
 * подгружаются по мере прокрутки вниз (и возврата назад), фильтры,
 * сортировка, total и баланс строки считаются на бэкенде.
 *
 * Каждая страница — отдельный ключ TanStack Query (['txPage', …]):
 * мутации инвалидируют префикс и видимые блоки перезапрашиваются.
 */
export function TransactionsGrid({
  params,
  tagsMap,
  total,
  onTotalChange,
  onSelectionChange,
  selectionResetRevision = 0,
  onEdit,
}: TransactionsGridProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const queryClient = useQueryClient()
  const { data: txRevision } = useQuery({ queryKey: ['txRevision'], queryFn: () => 0 })
  const gridRef = useRef<AgGridReact<TransactionView>>(null)
  const gridWrapperRef = useRef<HTMLDivElement>(null)
  const statsAccumulatorRef = useRef<StatsAccumulator>(createStatsAccumulator())
  const statsGenerationRef = useRef(0)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const statsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoveredHeaderRef = useRef<HTMLElement | null>(null)
  const selectionAnchorRef = useRef<number | null>(null)

  const [pageSize, setPageSize] = useState(50)
  const [, setStatsRevision] = useState(0)
  const [statsTarget, setStatsTarget] = useState<StatsTarget | null>(null)
  const [quickEditTarget, setQuickEditTarget] = useState<QuickEditTarget | null>(null)
  const [statsLoadingAll, setStatsLoadingAll] = useState(false)
  const [statsLoadError, setStatsLoadError] = useState<string | null>(null)

  // Свежие значения для замыкания datasource (без пересоздания на каждый рендер)
  const onTotalChangeRef = useRef(onTotalChange)
  onTotalChangeRef.current = onTotalChange
  const paramsRef = useRef(params)
  paramsRef.current = params

  // Смена фильтров/периода → перезагружаем блоки бесконечной прокрутки.
  // datasource уже читает свежие params через paramsRef (query-ключ включает
  // params, кэш не протухнет) — здесь только заставляем AG Grid перезапросить
  // видимые блоки и сбросить старый кэш.
  useEffect(() => {
    statsGenerationRef.current += 1
    statsAccumulatorRef.current = createStatsAccumulator()
    setStatsRevision((revision) => revision + 1)
    setStatsTarget(null)
    setStatsLoadingAll(false)
    setStatsLoadError(null)
    selectionAnchorRef.current = null
    const api = gridRef.current?.api
    if (!api) return
    api.purgeInfiniteCache()
  }, [params, txRevision])

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    if (statsCloseTimerRef.current) clearTimeout(statsCloseTimerRef.current)
  }, [])

  useEffect(() => {
    gridRef.current?.api?.deselectAll()
    selectionAnchorRef.current = null
  }, [selectionResetRevision])

  // Infinite-источник: блоки запрашиваются по мере прокрутки; sortModel
  // приходит от AG Grid при клике по заголовку — пробрасывается на бэкенд.
  const datasource = useMemo<IDatasource>(() => {
    const getRows = (p: IGetRowsParams): void => {
      const statsGeneration = statsGenerationRef.current
      const { startRow, endRow, sortModel, successCallback, failCallback } = p
      const sort = sortModel?.[0]
      const sortBy = (sort?.colId && sort?.sort ? sort.colId : 'date') as TransactionsPageParams['sort_by']
      // Без sortModel (или сброшенной сортировки) — по умолчанию по возрастанию даты.
      const sortDir: 'asc' | 'desc' = sort?.sort ?? 'asc'
      const limit = endRow - startRow
      void queryClient
        .fetchQuery({
          queryKey: ['txPage', paramsRef.current, sortBy, sortDir, limit, startRow],
          queryFn: () =>
            fetchTransactionsPage({
              limit,
              offset: startRow,
              ...paramsRef.current,
              sort_by: sortBy,
              sort_dir: sortDir,
            }),
          staleTime: 30_000,
        })
        .then((page) => {
          onTotalChangeRef.current(page.total ?? 0)
          const rows = page.items.map(toTransactionView)
          if (statsGeneration === statsGenerationRef.current && addRowsToStats(statsAccumulatorRef.current, rows)) {
            setStatsRevision((revision) => revision + 1)
          }
          successCallback(rows, page.total ?? 0)
        })
        .catch(() => failCallback())
    }
    return { getRows }
  }, [queryClient])

  // ESC — снять выделение строк (если оно есть)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const api = gridRef.current?.api
      if (!api) return
      const selected = api.getSelectedRows()
      if (selected.length > 0) {
        api.deselectAll()
        onSelectionChange?.([])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSelectionChange])

  const handleGridMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    const header = target?.closest<HTMLElement>('.ag-header-cell[col-id]') ?? null
    if (!header || !gridWrapperRef.current?.contains(header)) return
    const field = header.getAttribute('col-id') as StatsColumnId | null
    if (!field || !(field in statsAccumulatorRef.current.columns)) return
    if (statsCloseTimerRef.current) clearTimeout(statsCloseTimerRef.current)
    statsCloseTimerRef.current = null
    if (hoveredHeaderRef.current === header) return
    hoveredHeaderRef.current = header
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => {
      setStatsTarget({ field, anchor: header })
    }, 180)
  }

  const handleGridMouseOut = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target instanceof HTMLElement ? event.target : null
    const header = target?.closest<HTMLElement>('.ag-header-cell[col-id]') ?? null
    if (!header) return
    const relatedTarget = event.relatedTarget instanceof Node ? event.relatedTarget : null
    if (relatedTarget && header.contains(relatedTarget)) return
    if (relatedTarget instanceof Element && relatedTarget.closest('[data-column-stats-popover]')) return
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
    if (statsCloseTimerRef.current) clearTimeout(statsCloseTimerRef.current)
    statsCloseTimerRef.current = setTimeout(() => {
      hoveredHeaderRef.current = null
      setStatsTarget(null)
    }, 140)
  }

  const closeStats = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = null
    if (statsCloseTimerRef.current) clearTimeout(statsCloseTimerRef.current)
    statsCloseTimerRef.current = null
    hoveredHeaderRef.current = null
    setStatsTarget(null)
  }

  const loadAllStats = async () => {
    if (statsLoadingAll || total === null) return
    const generation = statsGenerationRef.current
    setStatsLoadingAll(true)
    setStatsLoadError(null)
    try {
      for (let offset = 0; offset < total; offset += 100) {
        const page = await queryClient.fetchQuery({
          queryKey: ['txPage', paramsRef.current, 'stats', 100, offset],
          queryFn: () => fetchTransactionsPage({ limit: 100, offset, ...paramsRef.current, sort_by: 'date', sort_dir: 'asc' }),
          staleTime: 30_000,
        })
        if (generation !== statsGenerationRef.current) return
        if (addRowsToStats(statsAccumulatorRef.current, page.items.map(toTransactionView))) {
          setStatsRevision((revision) => revision + 1)
        }
        if (page.items.length === 0) break
      }
    } catch {
      if (generation === statsGenerationRef.current) setStatsLoadError('Не удалось загрузить все данные. Попробуйте ещё раз.')
    } finally {
      if (generation === statsGenerationRef.current) setStatsLoadingAll(false)
    }
  }

  const handleRowClicked = (event: RowClickedEvent<TransactionView>) => {
    const mouseEvent = event.event
    if (!(mouseEvent instanceof MouseEvent) || mouseEvent.button !== 0 || event.node.rowIndex === null) return

    if (mouseEvent.shiftKey) {
      mouseEvent.preventDefault()
      const end = event.node.rowIndex
      const start = selectionAnchorRef.current ?? end
      event.api.deselectAll()
      for (const index of selectionRange(start, end)) {
        const node = event.api.getDisplayedRowAtIndex(index)
        if (node?.data) node.setSelected(true, false)
      }
      if (selectionAnchorRef.current === null) selectionAnchorRef.current = end
      return
    }

    if (mouseEvent.altKey) {
      mouseEvent.preventDefault()
      event.node.setSelected(!event.node.isSelected(), false)
      selectionAnchorRef.current = event.node.rowIndex
    }
  }

  const handleCellContextMenu = (event: CellContextMenuEvent<TransactionView>) => {
    const mouseEvent = event.event
    if (!(mouseEvent instanceof MouseEvent) || !event.data) return
    mouseEvent.preventDefault()
    const field = event.column.getColId() as QuickEditField
    if (!QUICK_EDIT_FIELDS.has(field)) return
    setQuickEditTarget((current) => replaceQuickEditTarget(current, { tx: event.data!, field, x: mouseEvent.clientX, y: mouseEvent.clientY }))
  }

  const handleQuickEditContextMenuThrough = (x: number, y: number, overlay: HTMLElement) => {
    const previousPointerEvents = overlay.style.pointerEvents
    overlay.style.pointerEvents = 'none'
    const underlying = document.elementFromPoint(x, y)
    overlay.style.pointerEvents = previousPointerEvents
    const cell = underlying?.closest<HTMLElement>('.ag-cell[col-id]')
    const row = cell?.closest<HTMLElement>('.ag-row[row-index]')
    const field = cell?.getAttribute('col-id') as QuickEditField | null
    const rowIndex = Number(row?.getAttribute('row-index'))
    const tx = Number.isInteger(rowIndex) ? gridRef.current?.api.getDisplayedRowAtIndex(rowIndex)?.data : undefined
    if (!tx || !field || !QUICK_EDIT_FIELDS.has(field)) return
    setQuickEditTarget((current) => replaceQuickEditTarget(current, { tx, field, x, y }))
  }

  // The revision state above turns the mutable accumulator into a render snapshot.
  const activeStats = statsTarget
    ? statsAccumulatorRef.current.columns[statsTarget.field]
    : null
  const loadedCount = statsAccumulatorRef.current.rowIds.size

  return (
    <Box
      ref={gridWrapperRef}
      onMouseOver={handleGridMouseOver}
      onMouseOut={handleGridMouseOut}
      sx={{
        position: 'relative',
        minWidth: 0,
        // The grid absorbs the remaining viewport height (page is a flex column);
        // falls back to its own scroll when the viewport is short (minHeight).
        flex: 1,
        minHeight: 320,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        className={`ag-theme-quartz${isDark ? '-dark' : ''} ag-theme-autoeco`}
        data-ag-dark={isDark}
        sx={{
          width: '100%',
          minWidth: 0,
          flex: 1,
          minHeight: 0,
          borderRadius: '6px',
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          bgcolor: 'var(--ag-background-color)',
          '--ag-income-color': colors.green,
          '--ag-expense-color': colors.red,
        }}
      >
        <AgGridReact<TransactionView>
          ref={gridRef}
          rowModelType="infinite"
          datasource={datasource}
          cacheBlockSize={pageSize}
          maxBlocksInCache={20}
          columnDefs={columnDefs}
          context={{ tagsMap }}
          defaultColDef={{
            sortable: true,
            resizable: true,
            suppressHeaderMenuButton: true,
          }}
          localeText={RU_LOCALE}
          rowHeight={48}
          headerHeight={42}
          suppressCellFocus
          rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: false, enableClickSelection: false }}
          selectionColumnDef={{
            width: 44,
            minWidth: 44,
            maxWidth: 44,
            sortable: false,
            resizable: false,
            suppressHeaderMenuButton: true,
          }}
          // Без initialState заголовки не показывают стрелку. Datasource
          // отправляет date/asc при отсутствии sortModel, поэтому порядок
          // остаётся стабильным: старые транзакции сверху.
          onSelectionChanged={() => {
            const ids =
              gridRef.current?.api
                ?.getSelectedRows()
                .map((r) => r.id)
                .filter(Boolean) ?? []
            onSelectionChange?.(ids)
          }}
          onRowDoubleClicked={(e) => {
            if (e.data) onEdit?.(e.data)
          }}
          onRowClicked={handleRowClicked}
          onCellContextMenu={handleCellContextMenu}
          suppressContextMenu
          preventDefaultOnContextMenu
          // Стабильный id строки: выделение переживает подгрузку блоков и refetch
          getRowId={(p) => p.data.id}
          domLayout="normal"
        />
      </Box>

      {/* Footer: total слева, размер блока подгрузки справа. */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 2,
          py: 1.25,
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: isDark ? 'var(--ag-header-background-color)' : 'background.paper',
          borderRadius: '0 0 6px 6px',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {total !== null && total !== undefined ? `Всего ${total} записей` : ''}
        </Typography>

        <Typography variant="caption" color="text.secondary" sx={{ display: { md: 'none', lg: 'block' }, whiteSpace: 'nowrap' }}>
          Alt — выбор · Shift — диапазон · ПКМ — изменить
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Подгружать по:
          </Typography>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            aria-label="Размер блока подгрузки"
            sx={{
              minWidth: 64,
              height: 32,
              borderRadius: '8px',
              fontSize: 13,
              bgcolor: 'background.paper',
              '& .MuiSelect-select': { py: 0.5, px: 1.5 },
            }}
          >
            {[10, 20, 50, 100].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </Select>
        </Box>
      </Box>

      <ColumnStatsPopover
        key={statsTarget?.field ?? 'closed'}
        anchorEl={statsTarget?.anchor ?? null}
        field={statsTarget?.field ?? null}
        stats={activeStats}
        loaded={loadedCount}
        total={total}
        tagsMap={tagsMap}
        loadingAll={statsLoadingAll}
        loadAllError={statsLoadError}
        onLoadAll={() => void loadAllStats()}
        onClose={closeStats}
        onMouseEnter={() => {
          if (statsCloseTimerRef.current) clearTimeout(statsCloseTimerRef.current)
          statsCloseTimerRef.current = null
        }}
      />

      <QuickEditPopover
        key={quickEditTarget ? `${quickEditTarget.tx.id}:${quickEditTarget.field}` : 'closed'}
        target={quickEditTarget}
        tags={[...tagsMap.values()]}
        onClose={() => setQuickEditTarget(null)}
        onContextMenuThrough={handleQuickEditContextMenuThrough}
      />
    </Box>
  )
}
