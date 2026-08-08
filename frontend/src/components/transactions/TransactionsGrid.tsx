import { useEffect, useMemo, useRef, useState } from 'react'
import { AgGridReact, type CustomCellRendererProps } from 'ag-grid-react'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import type { ColDef } from 'ag-grid-community'
import {
  Box,
  IconButton,
  MenuItem,
  Select,
  Typography,
  useTheme,
} from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined'
import { TagChip } from '../common/TagChip'
import { formatCurrency, formatNumber, formatShortDate } from '../../lib/format'
import { colors } from '../../theme'
import type { Tag, TransactionView } from '../../api/types'

interface GridContext {
  tagsMap: Map<string, Tag>
}

/** Russian locale for the grid internals (empty state, a11y labels). */
const RU_LOCALE = {
  page: 'Страница',
  to: 'из',
  of: 'из',
  next: 'Вперёд',
  previous: 'Назад',
  pageSizeSelectorLabel: 'Показывать по:',
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
    width: 72,
    minWidth: headerMinWidth('Дата'),
    valueFormatter: (p) => formatShortDate(p.value),
    comparator: (a: string, b: string) => a.localeCompare(b),
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
    cellRenderer: TagsCell,
    valueGetter: (p) => p.data?.tagId ?? null,
  },
  {
    field: 'description',
    headerName: 'Описание',
    flex: 1,
    // Перенос разрешён только здесь: длинный текст заворачивается,
    // строка растёт по высоте (autoHeight per-column).
    wrapText: true,
    autoHeight: true,
    minWidth: Math.max(140, headerMinWidth('Описание')),
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
]

interface TransactionsGridProps {
  rows: TransactionView[]
  tagsMap: Map<string, Tag>
}

/** Desktop data table (AG Grid). */
export function TransactionsGrid({ rows, tagsMap }: TransactionsGridProps) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const gridRef = useRef<AgGridReact<TransactionView>>(null)

  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Sync the custom footer with AG Grid's pagination state.
  useEffect(() => {
    const api = gridRef.current?.api
    if (!api) return
    const sync = () => {
      setPage(api.paginationGetCurrentPage() + 1)
      setTotalPages(Math.max(1, api.paginationGetTotalPages()))
    }
    sync()
    api.addEventListener('paginationChanged', sync)
    return () => api.removeEventListener('paginationChanged', sync)
  }, [])

  const pageButtons = useMemo(() => {
    const count = Math.max(1, totalPages)
    if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
    const windowStart = Math.min(Math.max(1, page - 2), count - 4)
    return [1, '…', windowStart + 1, windowStart + 2, windowStart + 3, '…', count] as (number | string)[]
  }, [page, totalPages])

  const gotoPage = (p: number) => gridRef.current?.api?.paginationGoToPage(p - 1)

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
          height: '100%',
          borderRadius: '6px',
          overflow: 'hidden',
          border: `1px solid ${theme.palette.divider}`,
          // Opaque fill matching the grid surface: the border's inner corner
          // radius (6px - 1px border) is slightly tighter than AG Grid's own
          // 6px wrapper radius, which would leave a hairline gap showing the
          // page background through the transparent container in dark mode.
          bgcolor: 'var(--ag-background-color)',
          // AG Grid inner frame matched via --ag-border-radius /
          // --ag-wrapper-border-radius / --ag-borders in index.css.
          '--ag-income-color': colors.green,
          '--ag-expense-color': colors.red,
          // The footer is rendered outside the grid (mockup layout).
          '& .ag-paging-panel': { display: 'none' },
        }}
      >
        <AgGridReact<TransactionView>
          ref={gridRef}
          rowData={rows}
          columnDefs={columnDefs}
          context={{ tagsMap }}
          defaultColDef={{
            sortable: true,
            resizable: true,
            suppressHeaderMenuButton: true,
          }}
          localeText={RU_LOCALE}
          pagination
          paginationPageSize={pageSize}
          paginationPageSizeSelector={false}
          rowHeight={48}
          headerHeight={42}
          suppressCellFocus
          rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: false }}
          selectionColumnDef={{
            width: 44,
            minWidth: 44,
            maxWidth: 44,
            sortable: false,
            resizable: false,
            suppressHeaderMenuButton: true,
          }}
          animateRows
          domLayout="normal"
        />
      </Box>

      {/* Mockup footer: total on the left, numbered pages in the middle,
          page-size selector on the right. */}
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
          Всего {rows.length} записей
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <IconButton
            size="small"
            aria-label="Предыдущая страница"
            disabled={page <= 1}
            onClick={() => gotoPage(page - 1)}
            sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '8px', bgcolor: 'background.paper' }}
          >
            <ChevronLeftIcon fontSize="small" />
          </IconButton>
          {pageButtons.map((p, i) =>
            typeof p === 'number' ? (
              <IconButton
                key={p}
                size="small"
                aria-label={`Страница ${p}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => gotoPage(p)}
                sx={{
                  minWidth: 32,
                  height: 32,
                  borderRadius: '8px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: p === page ? 'primary.main' : 'text.primary',
                  bgcolor: p === page ? 'action.selected' : 'background.paper',
                  border: `1px solid ${p === page ? 'transparent' : theme.palette.divider}`,
                  '&:hover': { bgcolor: 'action.hover' },
                }}
              >
                {p}
              </IconButton>
            ) : (
              <Typography key={`e${i}`} variant="body2" color="text.secondary" sx={{ px: 0.25 }}>
                …
              </Typography>
            ),
          )}
          <IconButton
            size="small"
            aria-label="Следующая страница"
            disabled={page >= totalPages}
            onClick={() => gotoPage(page + 1)}
            sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: '8px', bgcolor: 'background.paper' }}
          >
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Показывать по:
          </Typography>
          <Select
            size="small"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
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
