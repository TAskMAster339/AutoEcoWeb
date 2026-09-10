import { useQuery } from '@tanstack/react-query'
import { fetchMyLimits } from '../api/limits'

export function useUserLimits() {
  return useQuery({
    queryKey: ['user-limits'],
    queryFn: fetchMyLimits,
    staleTime: 30_000,
  })
}
