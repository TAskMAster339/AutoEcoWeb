import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/sellers'
import { userQueryKey } from '../lib/querySession'

export function useSellers() {
  return useQuery({ queryKey: userQueryKey('sellers'), queryFn: api.fetchSellers, staleTime: 30_000 })
}

function invalidateSellers(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: userQueryKey('sellers') })
  void queryClient.invalidateQueries({ queryKey: userQueryKey('stores') })
  void queryClient.invalidateQueries({ queryKey: userQueryKey('txPage') })
  void queryClient.invalidateQueries({ queryKey: userQueryKey('transactions') })
  void queryClient.invalidateQueries({ queryKey: userQueryKey('summary') })
  void queryClient.invalidateQueries({ queryKey: userQueryKey('analytics') })
  queryClient.setQueryData<number>(userQueryKey('txRevision'), (revision = 0) => revision + 1)
}

export function useUpdateSeller() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api.updateSeller(id, name), onSuccess: () => invalidateSellers(queryClient) })
}

export function useDeleteSeller() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: api.deleteSeller, onSuccess: () => invalidateSellers(queryClient) })
}
