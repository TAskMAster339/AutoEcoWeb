import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/tags'
import type { TagDraft } from '../api/tags'

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: api.fetchTags,
    staleTime: 30_000,
  })
}

export function useCreateTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: TagDraft) => api.createTag(draft),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteTag(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['tags'] }),
  })
}
