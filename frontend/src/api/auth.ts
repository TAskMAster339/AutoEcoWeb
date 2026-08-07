/**
 * Auth API — real endpoints, mirrors backend OpenAPI (backend/src/api/v1/auth.py).
 *
 * Tokens are NOT part of this contract anymore: the backend sets them as
 * HttpOnly cookies (Set-Cookie) and reads them from the request. JS never sees
 * a token — login returns the user, refresh/logout are cookie-driven.
 */
import { api } from './client'
import type { User } from './types'

export function login(email: string, password: string): Promise<User> {
  return api.post<User>('/api/v1/auth/login', { email, password })
}

export function register(email: string, password: string): Promise<User> {
  return api.post<User>('/api/v1/auth/register', { email, password })
}

export function fetchMe(): Promise<User> {
  return api.get<User>('/api/v1/auth/me')
}

/** The refresh token travels in the HttpOnly cookie; backend clears both cookies. */
export function logout(): Promise<void> {
  return api.post<void>('/api/v1/auth/logout')
}
