import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/feedback'
import type { FeedbackAnswer, FeedbackCreate } from '../api/types'
import { queryKeys } from '../lib/queryKeys'

export function useFeedback(status?: string, page = 0, limit = 20) {
  return useQuery({
    queryKey: queryKeys.feedback.list(status, page, limit),
    queryFn: ({ signal }) => api.fetchFeedback(status, limit, page * limit, signal),
    placeholderData: (previous) => previous,
  })
}

export function useMyFeedback() {
  return useQuery({
    queryKey: queryKeys.feedback.mine(),
    queryFn: ({ signal }) => api.fetchMyFeedback(signal),
  })
}

export function useCreateFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: FeedbackCreate) => api.createFeedback(data),
    onSuccess: () => { void client.invalidateQueries({ queryKey: queryKeys.feedback.all() }) },
  })
}

export function useAnswerFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FeedbackAnswer }) => api.answerFeedback(id, data),
    onSuccess: () => { void client.invalidateQueries({ queryKey: queryKeys.feedback.all() }) },
  })
}

export function useCloseFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.closeFeedback(id),
    onSuccess: () => { void client.invalidateQueries({ queryKey: queryKeys.feedback.all() }) },
  })
}
