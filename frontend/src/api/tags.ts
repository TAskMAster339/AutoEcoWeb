/**
 * Tags domain API (mock behind flag — see frontend/TODO.md).
 */
import { ApiError, delay } from './client'
import { USE_MOCK_API } from '../lib/config'
import { TAGS } from '../data/mock'
import { getAllTransactions } from './transactions'
import type { Tag } from './types'

let store: Tag[] = [...TAGS]

function recount(): Tag[] {
  const counts = new Map<string, number>()
  for (const tx of getAllTransactions()) {
    for (const tagId of tx.tagIds) {
      counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
    }
  }
  store = store.map((t) => ({ ...t, count: counts.get(t.id) ?? 0 }))
  return store
}

export async function fetchTags(): Promise<Tag[]> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт /api/v1/tags ещё не реализован')
  await delay(250)
  return recount()
}

export interface TagDraft {
  name: string
  color: string
}

export async function createTag(draft: TagDraft): Promise<Tag> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт POST /api/v1/tags ещё не реализован')
  await delay(200)
  const tag: Tag = { id: `t-${Date.now()}`, name: draft.name, color: draft.color, count: 0 }
  store = [...store, tag]
  return tag
}

export async function deleteTag(id: string): Promise<void> {
  if (!USE_MOCK_API) throw new ApiError(501, 'Эндпоинт DELETE /api/v1/tags/{id} ещё не реализован')
  await delay(200)
  store = store.filter((t) => t.id !== id)
}
