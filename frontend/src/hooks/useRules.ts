import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../api/rules'
import type { RuleDraft } from '../api/rules'

export function useRules() {
  return useQuery({
    queryKey: ['rules'],
    queryFn: api.fetchRules,
    staleTime: 30_000,
  })
}

export function useCreateRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (draft: RuleDraft) => api.createRule(draft),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rules'] }),
  })
}

export function useUpdateRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<RuleDraft> }) =>
      api.updateRule(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rules'] }),
  })
}

export function useDeleteRule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.deleteRule(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['rules'] }),
  })
}
