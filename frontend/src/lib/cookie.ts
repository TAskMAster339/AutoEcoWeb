/**
 * READONLY auth-token cookie storage.
 *
 * Tokens live ONLY here — they never enter Zustand, React state or localStorage.
 * The API client is the only reader; the auth store never sees the raw token.
 *
 * IMPORTANT (HttpOnly): a cookie created from JS via document.cookie can NOT carry
 * the HttpOnly flag — only a server Set-Cookie header can. So this module provides
 * app-level "read-only" semantics (write once, opaque to the rest of the app) plus
 * SameSite=Lax + Secure. For full XSS-proof HttpOnly cookies the backend should set
 * them via Set-Cookie on login/refresh — tracked in frontend/TODO.md.
 */

const ACCESS_COOKIE = 'autoeco_access'
const REFRESH_COOKIE = 'autoeco_refresh'

/** 30 min — mirrors backend access_token_expire_minutes. */
const ACCESS_MAX_AGE_SEC = 60 * 30
/** 30 days — mirrors backend refresh_token_expire_days. */
const REFRESH_MAX_AGE_SEC = 60 * 60 * 24 * 30

function baseAttributes(maxAgeSec: number): string {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:'
  return `path=/; max-age=${maxAgeSec}; SameSite=Lax${secure ? '; Secure' : ''}`
}

function setCookie(name: string, value: string, maxAgeSec: number): void {
  document.cookie = `${name}=${encodeURIComponent(value)}; ${baseAttributes(maxAgeSec)}`
}

function getCookie(name: string): string | null {
  const match = document.cookie
    .split('; ')
    .map((part) => part.split('='))
    .find(([key]) => key === name)
  return match ? decodeURIComponent(match[1] ?? '') : null
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}

/** Write both tokens into cookies (the single write point). */
export function setAuthTokens(accessToken: string, refreshToken: string): void {
  setCookie(ACCESS_COOKIE, accessToken, ACCESS_MAX_AGE_SEC)
  setCookie(REFRESH_COOKIE, refreshToken, REFRESH_MAX_AGE_SEC)
}

/** Refresh the access cookie only (used after /auth/refresh). */
export function setAccessToken(accessToken: string): void {
  setCookie(ACCESS_COOKIE, accessToken, ACCESS_MAX_AGE_SEC)
}

export function getAccessToken(): string | null {
  return getCookie(ACCESS_COOKIE)
}

export function getRefreshToken(): string | null {
  return getCookie(REFRESH_COOKIE)
}

export function clearAuthTokens(): void {
  deleteCookie(ACCESS_COOKIE)
  deleteCookie(REFRESH_COOKIE)
}
