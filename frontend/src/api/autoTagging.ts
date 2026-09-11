import { api } from './client'
import type { AutoTaggingStatus } from './types'

export function fetchAutoTaggingStatus(): Promise<AutoTaggingStatus> {
  return api.get<AutoTaggingStatus>('/api/v1/auto-tagging')
}

export function updateAutoTagging(enabled: boolean): Promise<AutoTaggingStatus> {
  return api.patch<AutoTaggingStatus>('/api/v1/auto-tagging', { enabled })
}

export function retrainAutoTagging(): Promise<AutoTaggingStatus> {
  return api.post<AutoTaggingStatus>('/api/v1/auto-tagging/retrain')
}
