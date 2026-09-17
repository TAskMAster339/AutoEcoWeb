import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAutoTaggingStatus,
  retrainAutoTagging,
  updateAutoTagging,
} from '../api/autoTagging'
import { userQueryKey } from '../lib/querySession'

export function useAutoTagging() {
  return useQuery({ queryKey: userQueryKey('auto-tagging'), queryFn: fetchAutoTaggingStatus })
}

export function useUpdateAutoTagging() {
  const queryClient = useQueryClient()
  const queryKey = userQueryKey('auto-tagging')
  return useMutation({
    mutationFn: updateAutoTagging,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })
}

export function useRetrainAutoTagging() {
  const queryClient = useQueryClient()
  const queryKey = userQueryKey('auto-tagging')
  return useMutation({
    mutationFn: retrainAutoTagging,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })
}
