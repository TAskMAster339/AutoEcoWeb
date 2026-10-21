import { useQuery } from '@tanstack/react-query'
import { fetchMyLimits } from '../api/limits'
import { queryKeys } from '../lib/queryKeys'

export function useUserLimits() {
  return useQuery({
    queryKey: queryKeys.userLimits.all(),
    queryFn: ({ signal }) => fetchMyLimits(signal),
    staleTime: 30_000,
  })
}
