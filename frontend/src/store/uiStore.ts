/**
 * UI store (Zustand) — period, filters, bottom sheets.
 * Persisted partially to localStorage (period preferences only, never tokens).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PeriodKey = 'thisMonth' | 'lastMonth' | '3m' | 'all' | 'custom' | 'month'
export type ThemeMode = 'light' | 'dark'

function systemTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

interface UiState {
  themeMode: ThemeMode
  periodKey: PeriodKey
  customFrom: string | null
  customTo: string | null
  /** Конкретный месяц в формате «YYYY-MM» (период 'month'). */
  monthYear: string | null
  search: string
  /** Мультивыбор: пустой массив = без фильтра. */
  tagFilterIds: string[]
  storeFilters: string[]
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
  setSearch: (value: string) => void
  setTagFilterIds: (tagIds: string[]) => void
  setStoreFilters: (stores: string[]) => void
  applyFilters: (filters: {
    search: string
    tagFilterIds: string[]
    storeFilters: string[]
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
      themeMode: systemTheme(),
      periodKey: 'all',
      customFrom: null,
      customTo: null,
      monthYear: null,
      search: '',
      tagFilterIds: [],
      storeFilters: [],
      addMenuOpen: false,
      receiptSheetOpen: false,
      transactionSheetOpen: false,
      filterSheetOpen: false,
      sidebarCollapsed: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      toggleThemeMode: () => set((s) => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setPeriodKey: (periodKey) => set({ periodKey }),
      setCustomRange: (customFrom, customTo) => set({ customFrom, customTo, periodKey: 'custom' }),
      setMonthPeriod: (monthYear) => set({ monthYear, periodKey: 'month' }),
      setSearch: (search) => set({ search }),
      setTagFilterIds: (tagFilterIds) => set({ tagFilterIds }),
      setStoreFilters: (storeFilters) => set({ storeFilters }),
      applyFilters: ({ search, tagFilterIds, storeFilters, periodKey }) =>
        set({ search, tagFilterIds, storeFilters, periodKey }),
      openAddMenu: () => set({ addMenuOpen: true }),
      closeAddMenu: () => set({ addMenuOpen: false }),
      openReceiptSheet: () => set({ receiptSheetOpen: true }),
      closeReceiptSheet: () => set({ receiptSheetOpen: false }),
      openTransactionSheet: () => set({ transactionSheetOpen: true }),
      closeTransactionSheet: () => set({ transactionSheetOpen: false }),
      openFilterSheet: () => set({ filterSheetOpen: true }),
      closeFilterSheet: () => set({ filterSheetOpen: false }),
      resetFilters: () =>
        set({ search: '', tagFilterIds: [], storeFilters: [], monthYear: null, periodKey: 'all' }),
    }),
    {
      name: 'autoeco-ui',
      partialize: (state) => ({
        themeMode: state.themeMode,
        periodKey: state.periodKey,
        customFrom: state.customFrom,
        customTo: state.customTo,
        monthYear: state.monthYear,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)
