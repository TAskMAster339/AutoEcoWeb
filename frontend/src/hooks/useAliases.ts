import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/aliases'
import type { AliasDraft } from '../api/types'

export function useAliases() {
  return useQuery({
    queryKey: ['aliases'],
    queryFn: api.fetchAliases,
    staleTime: 30_000,
  })
}

export function useCreateAlias() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: AliasDraft) => api.createAlias(draft),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['aliases'] }),
  })
}

export function useDeleteAlias() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteAlias(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['aliases'] }),
  })
}
