/**
 * Thin fetch wrapper around the backend API.
 *
 * - auth is cookie-driven: the backend sets HttpOnly cookies (Set-Cookie) and
 *   the browser sends them automatically — no Authorization header, JS never
 *   sees a token (credentials: 'include')
 * - transparently refreshes the session once on 401 (backend rotates cookies)
 * - surfaces a typed ApiError with a human-readable Russian message
 */

import { API_URL } from '../lib/config'

export class ApiError extends Error {
  readonly status: number
  readonly detail?: string
  readonly retryAfter?: number

  constructor(status: number, message: string, detail?: string, retryAfter?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.retryAfter = retryAfter
  }
}

export function messageFromError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Нет соединения с сервером'
    if (err.status === 429) return err.message
    if (err.status === 503) return err.detail ?? 'Сервис временно недоступен. Повторите позже.'
    if (err.status === 401) return 'Неверный email или пароль'
    if (err.status === 403) return 'Недостаточно прав'
    // деталь от бэкенда приоритетнее общих текстов (напр. 409 «Этот чек уже добавлен»)
    if (err.detail && typeof err.detail === 'string') return err.detail
    if (err.status === 409) return 'Такая запись уже существует'
    return err.message
  }
  return 'Что-то пошло не так'
}

/** Handles both gateway JSON errors and FastAPI responses, including refresh. */
async function errorFromResponse(res: Response): Promise<ApiError> {
  const value = res.headers.get('Retry-After')
  const numeric = value === null || value.trim() === '' ? NaN : Number(value)
  const seconds = Number.isFinite(numeric)
    ? numeric
    : value ? (Date.parse(value) - Date.now()) / 1000 : NaN
  const retryAfter = Number.isFinite(seconds) ? Math.max(0, Math.ceil(seconds)) : undefined
  let detail: string | undefined
  try {
    const json: unknown = await res.json()
    if (typeof json === 'object' && json !== null && 'detail' in json) {
      const d = (json as { detail?: unknown }).detail
      detail = typeof d === 'string' ? d : JSON.stringify(d)
    }
  } catch {
    // Gateways can also return empty or HTML error bodies.
  }
  const message = res.status === 429
    ? `Слишком много запросов. ${retryAfter !== undefined ? `Повторите через ${retryAfter} сек.` : 'Повторите позже.'}`
    : `Ошибка сервера (${res.status})`
  return new ApiError(res.status, message, detail, retryAfter)
}

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/** authStore registers a handler that signs the user out when refresh fails. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler
}

export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

type RefreshResult =
  | { kind: 'refreshed' }
  | { kind: 'unauthorized' }
  | { kind: 'error'; error: ApiError }

let refreshPromise: Promise<RefreshResult> | null = null

async function tryRefresh(): Promise<RefreshResult> {
  // The refresh token lives in an HttpOnly cookie — the browser sends it with
  // the request automatically; the backend rotates both cookies on success.
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    if (res.ok) return { kind: 'refreshed' }
    if (res.status === 401 || res.status === 403) return { kind: 'unauthorized' }
    return {
      kind: 'error',
      error: await errorFromResponse(res),
    }
  } catch {
    return {
      kind: 'error',
      error: new ApiError(0, 'Нет соединения с сервером'),
    }
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** set false for endpoints that must never trigger refresh (e.g. login) */
  auth?: boolean
  /** return the raw body as a Blob (file downloads) instead of parsed JSON */
  asBlob?: boolean
  /** internal guard: an original request may refresh the session only once */
  retryAfterRefresh?: boolean
  /** Cancels obsolete TanStack Query requests when their observer/key changes. */
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const isFormData = options.body instanceof FormData
  const headers: Record<string, string> = {}
  if (options.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: isFormData
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
      credentials: 'include',
      signal: options.signal,
    })
  } catch (error) {
    if (options.signal?.aborted) throw error
    throw new ApiError(0, 'Нет соединения с сервером')
  }

  // One transparent refresh attempt on 401 (except auth-less calls like login).
  if (
    res.status === 401
    && options.auth !== false
    && options.retryAfterRefresh !== false
  ) {
    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null
    })
    const refreshResult = await refreshPromise
    if (refreshResult.kind === 'refreshed') {
      return request<T>(path, { ...options, retryAfterRefresh: false })
    }
    if (refreshResult.kind === 'error') throw refreshResult.error
    // Refresh failed: the backend has already cleared the cookies — sign out.
    unauthorizedHandler?.()
    throw new ApiError(401, 'Сессия истекла. Войдите снова.')
  }

  if (res.status === 401 && options.auth !== false) {
    unauthorizedHandler?.()
    throw new ApiError(401, 'Сессия истекла. Войдите снова.')
  }

  if (!res.ok) {
    throw await errorFromResponse(res)
  }

  if (res.status === 204) return undefined as T
  if (options.asBlob) return (await res.blob()) as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> =>
    request<T>(path, options),
  post: <T>(path: string, body?: unknown, options: { auth?: boolean } = {}): Promise<T> =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'PATCH', body }),
  del: <T = void>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'DELETE', body }),
  /** multipart/form-data upload (file import) — browser sets the boundary */
  upload: <T>(path: string, form: FormData): Promise<T> =>
    request<T>(path, { method: 'POST', body: form }),
  /** raw binary download (xlsx export) */
  blob: (path: string): Promise<Blob> => request<Blob>(path, { asBlob: true }),
}
