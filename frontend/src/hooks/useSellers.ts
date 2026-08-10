import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/sellers'

export function useSellers() {
  return useQuery({ queryKey: ['sellers'], queryFn: api.fetchSellers, staleTime: 30_000 })
}

function invalidateSellers(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['sellers'] })
  void queryClient.invalidateQueries({ queryKey: ['stores'] })
  void queryClient.invalidateQueries({ queryKey: ['txPage'] })
  void queryClient.invalidateQueries({ queryKey: ['transactions'] })
  void queryClient.invalidateQueries({ queryKey: ['summary'] })
  void queryClient.invalidateQueries({ queryKey: ['analytics'] })
  queryClient.setQueryData<number>(['txRevision'], (revision = 0) => revision + 1)
}

export function useUpdateSeller() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api.updateSeller(id, name), onSuccess: () => invalidateSellers(queryClient) })
}

export function useDeleteSeller() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: api.deleteSeller, onSuccess: () => invalidateSellers(queryClient) })
}