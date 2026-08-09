import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import type { ColDef, IDatasource, IGetRowsParams } from 'ag-grid-community'
import { Box, MenuItem, Select, Typography, useTheme } from '@mui/material'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { useQueryClient } from '@tanstack/react-query'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatNumber, formatShortDate } from '../../lib/format'
import { colors } from '../../theme'
import {
  fetchTransactionsPage,
  toTransactionView,
  type TransactionsPageParams,
} from '../../api/transactions'
import type { Tag, TransactionView } from '../../api/types'

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
        <TagChip key={tag.id} tag={tag} size="compact" icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 13 }} />} />
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
  onEdit,
}: TransactionsGridProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const queryClient = useQueryClient()
  const gridRef = useRef<AgGridReact<TransactionView>>(null)

  const [pageSize, setPageSize] = useState(50)

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
    const api = gridRef.current?.api
    if (!api) return
    api.purgeInfiniteCache()
  }, [params])

  // Infinite-источник: блоки запрашиваются по мере прокрутки; sortModel
  // приходит от AG Grid при клике по заголовку — пробрасывается на бэкенд.
  const datasource = useMemo<IDatasource>(() => {
    const getRows = (p: IGetRowsParams): void => {
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
          successCallback(page.items.map(toTransactionView), page.total ?? 0)
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

  return (
    <Box
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
          rowSelection={{ mode: 'multiRow', checkboxes: true, enableClickSelection: false }}
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
    </Box>
  )
}
