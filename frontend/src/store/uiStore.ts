/**
 * UI store (Zustand) — global period, table-only filters and bottom sheets.
 * Persisted partially to localStorage (period preferences only, never tokens).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PeriodKey = 'thisMonth' | 'lastMonth' | '3m' | 'all' | 'custom' | 'month' | 'day'
export type ThemeMode = 'light' | 'dark' | 'system'
export type OperationFilter = 'all' | 'income' | 'expense'

/** Порядок циклического переключения темы: светлая → тёмная → системная → светлая. */
export const THEME_CYCLE: ThemeMode[] = ['light', 'dark', 'system']

interface UiState {
  themeMode: ThemeMode
  periodKey: PeriodKey
  customFrom: string | null
  customTo: string | null
  /** Конкретный месяц в формате «YYYY-MM» (период 'month'). */
  monthYear: string | null
  /** Конкретный день в формате «YYYY-MM-DD» (период 'day'). */
  dayDate: string | null
  search: string
  /** Черновик и последний применённый запрос графика цен на странице аналитики. */
  priceChartName: string
  priceChartIsRegex: boolean
  priceChartSubmittedName: string
  priceChartSubmittedIsRegex: boolean
  /** Мультивыбор: пустой массив = без фильтра. */
  tagFilterIds: string[]
  untaggedOnly: boolean
  storeFilters: string[]
  amountMin: string
  amountMax: string
  operationFilter: OperationFilter
  /** Меню «Добавить»: чек (QR/камера) или транзакция (форма). */
  addMenuOpen: boolean
  receiptSheetOpen: boolean
  transactionSheetOpen: boolean
  filterSheetOpen: boolean
  /** Desktop sidebar collapsed to a narrow icon rail. */
  sidebarCollapsed: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
  toggleSidebar: () => void
  setPeriodKey: (key: PeriodKey) => void
  setCustomRange: (from: string, to: string) => void
  /** Устанавливает период «конкретный месяц»: monthYear в формате «YYYY-MM». */
  setMonthPeriod: (monthYear: string) => void
  setDayPeriod: (dayDate: string) => void
  setSearch: (value: string) => void
  setPriceChartName: (name: string) => void
  setPriceChartIsRegex: (isRegex: boolean) => void
  submitPriceChart: (name: string, isRegex: boolean) => void
  setTagFilterIds: (tagIds: string[]) => void
  setStoreFilters: (stores: string[]) => void
  applyFilters: (filters: {
    search: string
    tagFilterIds: string[]
    untaggedOnly: boolean
    storeFilters: string[]
    amountMin: string
    amountMax: string
    operationFilter: OperationFilter
    periodKey: PeriodKey
  }) => void
  openAddMenu: () => void
  closeAddMenu: () => void
  openReceiptSheet: () => void
  closeReceiptSheet: () => void
  openTransactionSheet: () => void
  closeTransactionSheet: () => void
  openFilterSheet: () => void
  closeFilterSheet: () => void
  resetFilters: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      themeMode: 'system',
      periodKey: 'all',
      customFrom: null,
      customTo: null,
      monthYear: null,
      dayDate: null,
      search: '',
      priceChartName: '',
      priceChartIsRegex: false,
      priceChartSubmittedName: '',
      priceChartSubmittedIsRegex: false,
      tagFilterIds: [],
      untaggedOnly: false,
      storeFilters: [],
      amountMin: '',
      amountMax: '',
      operationFilter: 'all',
      addMenuOpen: false,
      receiptSheetOpen: false,
      transactionSheetOpen: false,
      filterSheetOpen: false,
      sidebarCollapsed: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      toggleThemeMode: () =>
        set((s) => ({
          themeMode: THEME_CYCLE[(THEME_CYCLE.indexOf(s.themeMode) + 1) % THEME_CYCLE.length],
        })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setPeriodKey: (periodKey) => set({ periodKey }),
      setCustomRange: (customFrom, customTo) => set({ customFrom, customTo, periodKey: 'custom' }),
      setMonthPeriod: (monthYear) => set({ monthYear, periodKey: 'month' }),
      setDayPeriod: (dayDate) => set({ dayDate, periodKey: 'day' }),
      setSearch: (search) => set({ search }),
      setPriceChartName: (priceChartName) => set({ priceChartName }),
      setPriceChartIsRegex: (priceChartIsRegex) => set({ priceChartIsRegex }),
      submitPriceChart: (priceChartSubmittedName, priceChartSubmittedIsRegex) =>
        set({ priceChartSubmittedName, priceChartSubmittedIsRegex }),
      setTagFilterIds: (tagFilterIds) => set({ tagFilterIds }),
      setStoreFilters: (storeFilters) => set({ storeFilters }),
      applyFilters: ({ search, tagFilterIds, untaggedOnly, storeFilters, amountMin, amountMax, operationFilter, periodKey }) =>
        set({ search, tagFilterIds, untaggedOnly, storeFilters, amountMin, amountMax, operationFilter, periodKey }),
      openAddMenu: () => set({ addMenuOpen: true }),
      closeAddMenu: () => set({ addMenuOpen: false }),
      openReceiptSheet: () => set({ receiptSheetOpen: true }),
      closeReceiptSheet: () => set({ receiptSheetOpen: false }),
      openTransactionSheet: () => set({ transactionSheetOpen: true }),
      closeTransactionSheet: () => set({ transactionSheetOpen: false }),
      openFilterSheet: () => set({ filterSheetOpen: true }),
      closeFilterSheet: () => set({ filterSheetOpen: false }),
      resetFilters: () =>
        set({ search: '', tagFilterIds: [], untaggedOnly: false, storeFilters: [], amountMin: '', amountMax: '', operationFilter: 'all' }),
    }),
    {
      name: 'autoeco-ui',
      partialize: (state) => ({
        themeMode: state.themeMode,
        periodKey: state.periodKey,
        customFrom: state.customFrom,
        customTo: state.customTo,
        monthYear: state.monthYear,
        dayDate: state.dayDate,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)
