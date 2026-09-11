import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchAutoTaggingStatus,
  retrainAutoTagging,
  updateAutoTagging,
} from '../api/autoTagging'

const queryKey = ['auto-tagging'] as const

export function useAutoTagging() {
  return useQuery({ queryKey, queryFn: fetchAutoTaggingStatus })
}

export function useUpdateAutoTagging() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateAutoTagging,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })
}

export function useRetrainAutoTagging() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: retrainAutoTagging,
    onSuccess: (data) => queryClient.setQueryData(queryKey, data),
  })
}
