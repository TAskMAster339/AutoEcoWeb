import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/sellers'
import { queryKeys } from '../lib/queryKeys'
import { invalidateSellerDomain } from '../lib/queryInvalidation'

export function useSellers() {
  return useQuery({
    queryKey: queryKeys.sellers.all(),
    queryFn: ({ signal }) => api.fetchSellers(signal),
    staleTime: 30_000,
  })
}

export function useUpdateSeller() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: ({ id, name }: { id: string; name: string }) => api.updateSeller(id, name), onSuccess: () => invalidateSellerDomain(queryClient) })
}

export function useDeleteSeller() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: api.deleteSeller, onSuccess: () => invalidateSellerDomain(queryClient) })
}
