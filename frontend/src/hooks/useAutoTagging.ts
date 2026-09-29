import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAutoTaggingStatus,
  retrainAutoTagging,
  updateAutoTagging,
} from '../api/autoTagging'
import { queryKeys } from '../lib/queryKeys'

export function useAutoTagging() {
  return useQuery({
    queryKey: queryKeys.autoTagging.all(),
    queryFn: ({ signal }) => fetchAutoTaggingStatus(signal),
  })
}

export function useUpdateAutoTagging() {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.autoTagging.all()
  return useMutation({
    mutationFn: updateAutoTagging,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })
}

export function useRetrainAutoTagging() {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.autoTagging.all()
  return useMutation({
    mutationFn: retrainAutoTagging,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })
}
