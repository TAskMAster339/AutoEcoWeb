import { api } from './client'
import type { UserLimitsOverview } from './types'

export function fetchMyLimits(): Promise<UserLimitsOverview> {
  return api.get<UserLimitsOverview>('/api/v1/limits/me')
}
