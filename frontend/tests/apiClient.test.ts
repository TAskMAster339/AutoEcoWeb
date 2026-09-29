import { afterEach, describe, expect, it, vi } from 'vitest'

import { api, ApiError, setUnauthorizedHandler } from '../src/api/client'

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
})
