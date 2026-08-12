import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/feedback'
import type { FeedbackAnswer, FeedbackCreate } from '../api/types'

export function useFeedback(status?: string, page = 0, limit = 20) {
  return useQuery({
    queryKey: ['feedback', status, page, limit],
    queryFn: () => api.fetchFeedback(status, limit, page * limit),
    placeholderData: (previous) => previous,
  })
}

export function useMyFeedback() {
  return useQuery({ queryKey: ['feedback', 'mine'], queryFn: api.fetchMyFeedback })
}

export function useCreateFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: FeedbackCreate) => api.createFeedback(data),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['feedback'] }) },
  })
}

export function useAnswerFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: FeedbackAnswer }) => api.answerFeedback(id, data),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['feedback'] }) },
  })
}

export function useCloseFeedback() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.closeFeedback(id),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ['feedback'] }) },
  })
}
