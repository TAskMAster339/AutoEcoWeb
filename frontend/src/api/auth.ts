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

/** Подтверждение почты 6-значным кодом из письма (POST /api/v1/auth/verify-email). */
export function verifyEmail(email: string, code: string): Promise<User> {
  return api.post<User>('/api/v1/auth/verify-email', { email, code })
}

/** Новый код подтверждения почты (POST /api/v1/auth/verify-email/resend). */
export function resendVerification(email: string): Promise<void> {
  return api.post<void>('/api/v1/auth/verify-email/resend', { email })
}

/** Запрос кода восстановления пароля (POST /api/v1/auth/password-recovery/request). */
export function requestPasswordRecovery(email: string): Promise<void> {
  return api.post<void>('/api/v1/auth/password-recovery/request', { email })
}

/** Проверка кода восстановления (POST /api/v1/auth/password-recovery/verify). */
export function verifyRecoveryCode(email: string, code: string): Promise<void> {
  return api.post<void>('/api/v1/auth/password-recovery/verify', { email, code })
}

/** Смена пароля по коду (POST /api/v1/auth/password-recovery/reset). */
export function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  return api.post<void>('/api/v1/auth/password-recovery/reset', {
    email,
    code,
    new_password: newPassword,
  })
}

export function fetchMe(): Promise<User> {
  return api.get<User>('/api/v1/auth/me')
}

/** The refresh token travels in the HttpOnly cookie; backend clears both cookies. */
export function logout(): Promise<void> {
  return api.post<void>('/api/v1/auth/logout')
}

/** Статус токена proverkacheka (GET /api/v1/auth/me/proverkacheka-token). */
export function fetchProverkachekaTokenStatus(): Promise<{ has_token: boolean }> {
  return api.get<{ has_token: boolean }>('/api/v1/auth/me/proverkacheka-token')
}

/** Сохранение токена proverkacheka (PUT /api/v1/auth/me/proverkacheka-token). */
export function saveProverkachekaToken(token: string): Promise<{ has_token: boolean }> {
  return api.put<{ has_token: boolean }>('/api/v1/auth/me/proverkacheka-token', { token })
}

/**
 * Смена пароля (POST /api/v1/auth/change-password).
 * Бэкенд проверяет текущий пароль, отзывает остальные сессии и ротирует куки.
 */
export function changePassword(currentPassword: string, newPassword: string): Promise<User> {
  return api.post<User>('/api/v1/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
}
