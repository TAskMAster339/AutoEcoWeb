import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/aliases'
import { useUiStore } from '../store/uiStore'
import type { AliasDraft, AliasScope, AliasUpdatePatch } from '../api/types'

const PAGE_SIZE = 50

export function useAliases(scope: AliasScope, search = '') {
  return useInfiniteQuery({
    queryKey: ['aliases', scope, search],
    queryFn: ({ pageParam }) => api.fetchAliasesPage({ scope, limit: PAGE_SIZE, offset: pageParam, search: search.trim() || undefined }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, p) => n + p.items.length, 0)
      return last.total != null && loaded < last.total ? loaded : undefined
    },
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

function invalidateAfterAliasChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.setQueryData<number>(['txRevision'], (revision = 0) => revision + 1)
  void queryClient.invalidateQueries({ queryKey: ['aliases'] })
  void queryClient.invalidateQueries({ queryKey: ['txPage'] })
  void queryClient.invalidateQueries({ queryKey: ['transactions'] })
  void queryClient.invalidateQueries({ queryKey: ['receipts'] })
  void queryClient.invalidateQueries({ queryKey: ['summary'] })
  void queryClient.invalidateQueries({ queryKey: ['analytics'] })
  void queryClient.invalidateQueries({ queryKey: ['stores'] })
  void queryClient.invalidateQueries({ queryKey: ['user-limits'] })
}

function updateSellerFilterAfterAlias(scope: AliasScope, originalName: string, aliasName: string) {
  if (scope !== 'seller') return
  const state = useUiStore.getState()
  if (state.storeFilters.includes(originalName)) state.setStoreFilters(state.storeFilters.map((store) => store === originalName ? aliasName : store))
}

function updateProductSearchAfterAlias(scope: AliasScope, originalName: string, aliasName: string) {
  if (scope !== 'product' || !originalName) return
  const state = useUiStore.getState()
  if (!state.search) return
  const escaped = originalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nextSearch = state.search.replace(new RegExp(escaped, 'gi'), aliasName)
  if (nextSearch !== state.search) state.setSearch(nextSearch)
}

export function useCreateAlias() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: (draft: AliasDraft) => api.createAlias(draft), onSuccess: (_alias, draft) => { invalidateAfterAliasChange(queryClient); updateSellerFilterAfterAlias(draft.scope ?? 'seller', draft.original_name, draft.alias_name); updateProductSearchAfterAlias(draft.scope ?? 'seller', draft.original_name, draft.alias_name) } })
}
export function useUpdateAlias() { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ id, patch }: { id: string; patch: AliasUpdatePatch }) => api.updateAlias(id, patch), onSuccess: () => invalidateAfterAliasChange(queryClient) }) }
export function useDeleteAlias() { const queryClient = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.deleteAlias(id), onSuccess: () => invalidateAfterAliasChange(queryClient) }) }
export function useApplyAliases() { const queryClient = useQueryClient(); return useMutation({ mutationFn: (scope?: AliasScope) => api.applyAliases(scope), onSuccess: () => invalidateAfterAliasChange(queryClient) }) }
