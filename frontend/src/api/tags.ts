/**
 * Tags domain API — real endpoints, mirrors backend OpenAPI
 * (backend/src/api/v1/tags.py). Счётчик `count` бэкенд не отдаёт —
 * вычисляется на клиенте из чеков (TagsPage через useTransactions).
 */
import { api } from './client'
import type { Tag } from './types'

/** Mirrors backend TagResponse (schemas/tag.py). */
interface TagResponse {
  id: string
  name: string
  color: string
  icon: string | null
  created_at: string
}

function toTag(t: TagResponse): Tag {
  return { id: t.id, name: t.name, color: t.color, count: 0 }
}

export async function fetchTags(): Promise<Tag[]> {
  const tags = await api.get<TagResponse[]>('/api/v1/tags')
  return tags.map(toTag)
}

export interface TagDraft {
  name: string
  color: string
}

export async function createTag(draft: TagDraft): Promise<Tag> {
  const tag = await api.post<TagResponse>('/api/v1/tags', draft)
  return toTag(tag)
}

export function deleteTag(id: string): Promise<void> {
  return api.del(`/api/v1/tags/${id}`)
}
