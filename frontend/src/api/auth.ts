/**
 * Auth API — real endpoints, mirrors backend OpenAPI (backend/src/api/v1/auth.py).
 */
import { api } from './client'
import type { LoginResponse, TokenPair, User } from './types'

export function login(email: string, password: string): Promise<LoginResponse> {
  return api.post<LoginResponse>('/api/v1/auth/login', { email, password })
}

export function register(email: string, password: string): Promise<User> {
  return api.post<User>('/api/v1/auth/register', { email, password })
}

/** Used only by the cookie refresh flow (client.ts). Exposed for completeness. */
export function refresh(refreshToken: string): Promise<TokenPair> {
  return api.post<TokenPair>('/api/v1/auth/refresh', { refresh_token: refreshToken })
}

export function fetchMe(): Promise<User> {
  return api.get<User>('/api/v1/auth/me')
}

export function logout(refreshToken: string): Promise<void> {
  return api.post<void>('/api/v1/auth/logout', { refresh_token: refreshToken })
}
