/**
 * UI store (Zustand) — period, filters, bottom sheets.
 * Persisted partially to localStorage (period preferences only, never tokens).
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type PeriodKey = 'thisMonth' | 'lastMonth' | '3m' | 'all' | 'custom'
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
  search: string
  tagFilterId: string | null
  storeFilter: string | null
  addSheetOpen: boolean
  filterSheetOpen: boolean
  /** Desktop sidebar collapsed to a narrow icon rail. */
  sidebarCollapsed: boolean
  setThemeMode: (mode: ThemeMode) => void
  toggleThemeMode: () => void
  toggleSidebar: () => void
  setPeriodKey: (key: PeriodKey) => void
  setCustomRange: (from: string, to: string) => void
  setSearch: (value: string) => void
  setTagFilter: (tagId: string | null) => void
  setStoreFilter: (store: string | null) => void
  openAddSheet: () => void
  closeAddSheet: () => void
  openFilterSheet: () => void
  closeFilterSheet: () => void
  resetFilters: () => void
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      themeMode: systemTheme(),
      periodKey: 'thisMonth',
      customFrom: null,
      customTo: null,
      search: '',
      tagFilterId: null,
      storeFilter: null,
      addSheetOpen: false,
      filterSheetOpen: false,
      sidebarCollapsed: false,

      setThemeMode: (themeMode) => set({ themeMode }),
      toggleThemeMode: () => set((s) => ({ themeMode: s.themeMode === 'light' ? 'dark' : 'light' })),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setPeriodKey: (periodKey) => set({ periodKey }),
      setCustomRange: (customFrom, customTo) => set({ customFrom, customTo, periodKey: 'custom' }),
      setSearch: (search) => set({ search }),
      setTagFilter: (tagFilterId) => set({ tagFilterId }),
      setStoreFilter: (storeFilter) => set({ storeFilter }),
      openAddSheet: () => set({ addSheetOpen: true }),
      closeAddSheet: () => set({ addSheetOpen: false }),
      openFilterSheet: () => set({ filterSheetOpen: true }),
      closeFilterSheet: () => set({ filterSheetOpen: false }),
      resetFilters: () => set({ search: '', tagFilterId: null, storeFilter: null, periodKey: 'thisMonth' }),
    }),
    {
      name: 'autoeco-ui',
      partialize: (state) => ({
        themeMode: state.themeMode,
        periodKey: state.periodKey,
        customFrom: state.customFrom,
        customTo: state.customTo,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
)
