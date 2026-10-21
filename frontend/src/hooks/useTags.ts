import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/tags'
import type { TagDraft, TagUpdatePatch } from '../api/tags'
import { queryKeys } from '../lib/queryKeys'

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags.all(),
    queryFn: ({ signal }) => api.fetchTags(signal),
    staleTime: 30_000,
  })
}

export function useInfiniteTags() {
  return useInfiniteQuery({
    queryKey: queryKeys.tags.pages(),
    queryFn: ({ pageParam, signal }) => api.fetchTagsPage(30, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.next_cursor == null ? undefined : Number(last.next_cursor)),
    staleTime: 30_000,
  })
}

function invalidateTags(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: queryKeys.tags.all() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.tags.pages() })
  void queryClient.invalidateQueries({ queryKey: queryKeys.userLimits.all() })
}

export function useCreateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: TagDraft) => api.createTag(draft),
    onSuccess: () => invalidateTags(queryClient),
  })
}

export function useUpdateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TagUpdatePatch }) => api.updateTag(id, patch),
    onSuccess: () => invalidateTags(queryClient),
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTag(id),
    onSuccess: () => invalidateTags(queryClient),
  })
}
