import { afterEach, describe, expect, it, vi } from 'vitest'

const authApi = vi.hoisted(() => ({
  fetchMe: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  resendVerification: vi.fn(),
  logout: vi.fn().mockResolvedValue(undefined),
  changePassword: vi.fn(),
}))
const clientState = vi.hoisted(() => ({
  unauthorizedHandler: null as (() => void) | null,
}))

vi.mock('../src/api/auth', () => authApi)
vi.mock('../src/api/client', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/api/client')>(),
  messageFromError: () => 'Ошибка',
  setUnauthorizedHandler: (handler: () => void) => {
    clientState.unauthorizedHandler = handler
  },
}))

import { clearQuerySession, queryClient, userQueryKey } from '../src/lib/querySession'
import { useAuthStore } from '../src/store/authStore'
import type { User } from '../src/api/types'

const alice: User = { id: 'alice', email: 'alice@example.test', role: 'user', status: 'active' }
const bob: User = { id: 'bob', email: 'bob@example.test', role: 'user', status: 'active' }

afterEach(() => {
  clearQuerySession()
  useAuthStore.setState({ user: null, status: 'idle', error: null })
  vi.clearAllMocks()
})

describe('query session boundary', () => {
  it('scopes keys by user and clears cached data when the user id changes', () => {
    useAuthStore.setState({ user: alice, status: 'authenticated', error: null })
    const aliceKey = userQueryKey('transactions')
    queryClient.setQueryData(aliceKey, ['alice transaction'])

    useAuthStore.setState({ user: alice, status: 'authenticated', error: null })
    expect(queryClient.getQueryData(aliceKey)).toEqual(['alice transaction'])

    useAuthStore.setState({ user: bob, status: 'authenticated', error: null })
    expect(queryClient.getQueryData(aliceKey)).toBeUndefined()
    expect(userQueryKey('transactions')).toEqual(['user', 'bob', 'transactions'])
  })

  it('clears the cache after logout even when the server request succeeds', async () => {
    useAuthStore.setState({ user: alice, status: 'authenticated', error: null })
    queryClient.setQueryData(userQueryKey('receipts'), ['private receipt'])

    await useAuthStore.getState().logout()

    expect(authApi.logout).toHaveBeenCalledOnce()
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('clears the cache when the API reports an unrecoverable 401', () => {
    useAuthStore.setState({ user: alice, status: 'authenticated', error: null })
    queryClient.setQueryData(userQueryKey('summary'), { balance: 100 })

    clientState.unauthorizedHandler?.()

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
    expect(useAuthStore.getState().status).toBe('unauthenticated')
  })

  it('force-clears anonymous cache entries when a session ends', () => {
    queryClient.setQueryData(userQueryKey('bootstrap'), 'temporary')

    clearQuerySession()

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0)
  })
})

describe('auth bootstrap failures', () => {
  it.each([
    [0, 'offline'],
    [503, 'error'],
  ] as const)('keeps a temporary status for API error %s', async (apiStatus, expectedStatus) => {
    authApi.fetchMe.mockRejectedValueOnce({ status: apiStatus })

    await useAuthStore.getState().bootstrap()

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      status: expectedStatus,
      error: 'Ошибка',
    })
  })

  it('allows retry after a temporary bootstrap failure', async () => {
    authApi.fetchMe
      .mockRejectedValueOnce({ status: 0 })
      .mockResolvedValueOnce(alice)

    await useAuthStore.getState().bootstrap()
    await useAuthStore.getState().bootstrap()

    expect(authApi.fetchMe).toHaveBeenCalledTimes(2)
    expect(useAuthStore.getState()).toMatchObject({
      user: alice,
      status: 'authenticated',
    })
  })

  it('treats only an explicit 401 as an ended session', async () => {
    authApi.fetchMe.mockRejectedValueOnce({ status: 401 })

    await useAuthStore.getState().bootstrap()

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      status: 'unauthenticated',
      error: null,
    })
  })
})
