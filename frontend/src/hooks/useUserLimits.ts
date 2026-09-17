import { useQuery } from '@tanstack/react-query'
import { fetchMyLimits } from '../api/limits'
import { userQueryKey } from '../lib/querySession'

export function useUserLimits() {
  return useQuery({
    queryKey: userQueryKey('user-limits'),
    queryFn: fetchMyLimits,
    staleTime: 30_000,
  })
}
