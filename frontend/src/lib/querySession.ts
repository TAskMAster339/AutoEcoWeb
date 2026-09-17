import { QueryClient } from '@tanstack/react-query'

const ANONYMOUS_SCOPE = 'anonymous'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

let sessionUserId: string | null = null

/**
 * Moves the query cache to another authenticated user. Cache contents are
 * discarded before the new scope can be used, preventing data from a previous
 * account from surviving a user switch on a shared device.
 */
export function setQuerySessionUser(userId: string | null): void {
  if (sessionUserId === userId) return
  sessionUserId = userId
  queryClient.clear()
}

/** Ends the current query session even if auth state was already cleared. */
export function clearQuerySession(): void {
  sessionUserId = null
  queryClient.clear()
}

/** Every server-state key must be nested under the active user session. */
export function userQueryKey<const T extends readonly unknown[]>(...parts: T) {
  return ['user', sessionUserId ?? ANONYMOUS_SCOPE, ...parts] as const
}
