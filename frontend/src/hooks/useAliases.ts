import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/aliases'
import { useUiStore } from '../store/uiStore'
import type { AliasDraft, AliasScope, AliasUpdatePatch } from '../api/types'
import { queryKeys } from '../lib/queryKeys'
import { invalidateAliasDomain } from '../lib/queryInvalidation'

const PAGE_SIZE = 50

export function useAliases(scope: AliasScope, search = '') {
  return useInfiniteQuery({
    queryKey: queryKeys.aliases.list(scope, search),
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
  return useMutation({ mutationFn: (draft: AliasDraft) => api.createAlias(draft), onSuccess: (_alias, draft) => { void invalidateAliasDomain(queryClient); updateSellerFilterAfterAlias(draft.scope ?? 'seller', draft.original_name, draft.alias_name); updateProductSearchAfterAlias(draft.scope ?? 'seller', draft.original_name, draft.alias_name) } })
}
export function useUpdateAlias() { const queryClient = useQueryClient(); return useMutation({ mutationFn: ({ id, patch }: { id: string; patch: AliasUpdatePatch }) => api.updateAlias(id, patch), onSuccess: () => invalidateAliasDomain(queryClient) }) }
export function useDeleteAlias() { const queryClient = useQueryClient(); return useMutation({ mutationFn: (id: string) => api.deleteAlias(id), onSuccess: () => invalidateAliasDomain(queryClient) }) }
export function useApplyAliases() { const queryClient = useQueryClient(); return useMutation({ mutationFn: (scope?: AliasScope) => api.applyAliases(scope), onSuccess: () => invalidateAliasDomain(queryClient) }) }
