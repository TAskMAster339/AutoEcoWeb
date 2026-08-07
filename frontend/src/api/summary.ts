/**
 * Summary + analytics domain API (mock behind flag — see frontend/TODO.md).
 */
import { ApiError, delay } from './client'
import { USE_MOCK_API } from '../lib/config'
import { MOCK_ANALYTICS, buildSummary } from '../data/mock'
import type { AnalyticsData, Summary } from './types'

export async function fetchSummary(): Promise<Summary> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт /api/v1/transactions/summary ещё не реализован')
  await delay(250)
  return buildSummary()
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт /api/v1/analytics ещё не реализован')
  await delay(350)
  return MOCK_ANALYTICS
}
