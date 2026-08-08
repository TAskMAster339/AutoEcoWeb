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

  constructor(status: number, message: string, detail?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function messageFromError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 0) return 'Нет соединения с сервером'
    if (err.status === 401) return 'Неверный email или пароль'
    if (err.status === 403) return 'Недостаточно прав'
    // деталь от бэкенда приоритетнее общих текстов (напр. 409 «Этот чек уже добавлен»)
    if (err.detail && typeof err.detail === 'string') return err.detail
    if (err.status === 409) return 'Такая запись уже существует'
    return err.message
  }
  return 'Что-то пошло не так'
}

type UnauthorizedHandler = () => void
let unauthorizedHandler: UnauthorizedHandler | null = null

/** authStore registers a handler that signs the user out when refresh fails. */
export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler
}

export const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

let refreshPromise: Promise<boolean> | null = null

async function tryRefresh(): Promise<boolean> {
  // The refresh token lives in an HttpOnly cookie — the browser sends it with
  // the request automatically; the backend rotates both cookies on success.
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    })
    return res.ok
  } catch {
    return false
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  /** set false for endpoints that must never trigger refresh (e.g. login) */
  auth?: boolean
  /** return the raw body as a Blob (file downloads) instead of parsed JSON */
  asBlob?: boolean
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
    })
  } catch {
    throw new ApiError(0, 'Нет соединения с сервером')
  }

  // One transparent refresh attempt on 401 (except auth-less calls like login).
  if (res.status === 401 && options.auth !== false) {
    refreshPromise ??= tryRefresh().finally(() => {
      refreshPromise = null
    })
    const refreshed = await refreshPromise
    if (refreshed) {
      return request<T>(path, options)
    }
    // Refresh failed: the backend has already cleared the cookies — sign out.
    unauthorizedHandler?.()
    throw new ApiError(401, 'Сессия истекла. Войдите снова.')
  }

  if (!res.ok) {
    let detail: string | undefined
    try {
      const json: unknown = await res.json()
      if (typeof json === 'object' && json !== null && 'detail' in json) {
        const d = (json as { detail?: unknown }).detail
        detail = typeof d === 'string' ? d : JSON.stringify(d)
      }
    } catch {
      // non-JSON error body — ignore
    }
    throw new ApiError(res.status, `Ошибка сервера (${res.status})`, detail)
  }

  if (res.status === 204) return undefined as T
  if (options.asBlob) return (await res.blob()) as T
  return (await res.json()) as T
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>(path, { method: 'POST', body }),
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
