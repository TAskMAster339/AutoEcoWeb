import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError, messageFromError, setUnauthorizedHandler } from '../src/api/client'

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(() => undefined)
})

describe('API refresh retry boundary', () => {
  it('attempts refresh only once when the retried request is still unauthorized', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/v1/private')).rejects.toMatchObject<ApiError>({
      status: 401,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/api/v1/auth/refresh')
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does not sign out when refresh fails because the network is unavailable', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/v1/private')).rejects.toMatchObject<ApiError>({
      status: 0,
    })

    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not sign out when refresh fails with a temporary server error', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/v1/private')).rejects.toMatchObject<ApiError>({
      status: 503,
    })

    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('passes AbortSignal to fetch and preserves cancellation errors', async () => {
    const controller = new AbortController()
    const abortError = new DOMException('Aborted', 'AbortError')
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      expect(init?.signal).toBe(controller.signal)
      controller.abort()
      throw abortError
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.get('/api/v1/search', { signal: controller.signal }))
      .rejects.toBe(abortError)
  })
})


describe('rate limit responses', () => {
  it.each(['60', 'Wed, 21 Oct 2026 12:01:00 GMT'])('shows Retry-After %s without retrying a mutation', async (retryAfter) => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('Wed, 21 Oct 2026 12:00:00 GMT'))
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ detail: 'Слишком много запросов' }),
      { status: 429, headers: { 'Retry-After': retryAfter } },
    ))
    vi.stubGlobal('fetch', fetchMock)
    const error = await api.post('/api/v1/feedback', { message: 'Сохранить' }).catch((e: unknown) => e)
    expect(error).toMatchObject({ status: 429, retryAfter: 60 })
    expect(messageFromError(error)).toContain('60 сек.')
    expect(fetchMock).toHaveBeenCalledOnce()
    vi.restoreAllMocks()
  })

  it('preserves the session when refresh is rate limited', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 429, headers: { 'Retry-After': '5' } })))
    await expect(api.get('/api/v1/private')).rejects.toMatchObject({ status: 429, retryAfter: 5 })
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('does not automatically retry a rate limited query', async () => {
    const { queryClient } = await import('../src/lib/querySession')
    const queryFn = vi.fn().mockRejectedValue(new ApiError(429, 'Подождите'))
    await expect(queryClient.fetchQuery({ queryKey: ['rate-limit-test'], queryFn })).rejects.toMatchObject({ status: 429 })
    expect(queryFn).toHaveBeenCalledOnce()
    queryClient.clear()
  })
})
