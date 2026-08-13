/**
 * Tags domain API — real endpoints, mirrors backend OpenAPI
 * (backend/src/api/v1/tags.py). Счётчик `count` считает backend.
 */
import { api } from './client'
import type { CursorPage, Tag } from './types'

/** Mirrors backend TagResponse (schemas/tag.py). */
interface TagResponse {
  id: string
  name: string
  color: string
  icon: string | null
  count: number
  created_at: string
}

function toTag(t: TagResponse): Tag {
  return { id: t.id, name: t.name, color: t.color, icon: t.icon, count: t.count }
}

export async function fetchTags(): Promise<Tag[]> {
  const tags = await api.get<TagResponse[]>('/api/v1/tags')
  return tags.map(toTag)
}

export async function fetchTagsPage(limit: number, offset: number): Promise<CursorPage<Tag>> {
  const page = await api.get<{ items: TagResponse[]; total: number | null }>(
    `/api/v1/tags/page?limit=${limit}&offset=${offset}`,
  )
  return {
    items: page.items.map(toTag),
    total: page.total,
    next_cursor:
      page.total != null && offset + page.items.length < page.total
        ? String(offset + page.items.length)
        : null,
  }
}

export interface TagDraft {
  name: string
  color: string
  icon: string | null
}

export interface TagUpdatePatch {
  name?: string
  color?: string
  icon?: string | null
}

export async function createTag(draft: TagDraft): Promise<Tag> {
  const tag = await api.post<TagResponse>('/api/v1/tags', draft)
  return toTag(tag)
}

export async function updateTag(id: string, patch: TagUpdatePatch): Promise<Tag> {
  const tag = await api.patch<TagResponse>(`/api/v1/tags/${id}`, patch)
  return toTag(tag)
}

export function deleteTag(id: string): Promise<void> {
  return api.del(`/api/v1/tags/${id}`)
}
