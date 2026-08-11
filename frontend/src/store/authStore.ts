/**
 * Auth store (Zustand).
 *
 * Holds ONLY the user + status. Tokens live in backend-set HttpOnly cookies
 * (Set-Cookie) — the store and the whole app never see them.
 */
import { create } from 'zustand'
import * as authApi from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import { messageFromError } from '../api/client'
import type { User } from '../api/types'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

interface AuthState {
  user: User | null
  status: AuthStatus
  error: string | null
  /** Called once on app start: restores session from the cookie. */
  bootstrap: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string) => Promise<boolean>
  /** Подтверждение почты кодом из письма (pending → verified). */
  verifyEmail: (email: string, code: string) => Promise<boolean>
  /** Запросить новый код подтверждения почты. */
  resendVerification: (email: string) => Promise<boolean>
  logout: () => Promise<void>
  /** Смена пароля — бэкенд ротирует куки, в сторе обновляется пользователь. */
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>
  resetError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,

  bootstrap: async () => {
    set({ status: 'loading', error: null })
    try {
      const user = await authApi.fetchMe()
      set({ user, status: 'authenticated' })
    } catch {
      // client already attempted a refresh; if it failed, the backend cleared
      // the cookies. Nothing to wipe locally — tokens never live in JS.
      set({ user: null, status: 'unauthenticated' })
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const user = await authApi.login(email, password)
      set({ user, status: 'authenticated' })
      return true
    } catch (err) {
      set({ status: 'unauthenticated', error: messageFromError(err) })
      return false
    }
  },

  register: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      // Регистрация создаёт пользователя со статусом pending и отправляет код
      // на почту — входа нет до подтверждения и активации администратором.
      await authApi.register(email, password)
      set({ status: 'unauthenticated', error: null })
      return true
    } catch (err) {
      set({ status: 'unauthenticated', error: messageFromError(err) })
      return false
    }
  },

  verifyEmail: async (email, code) => {
    try {
      await authApi.verifyEmail(email, code)
      set({ error: null })
      return true
    } catch (err) {
      set({ error: messageFromError(err) })
      return false
    }
  },

  resendVerification: async (email) => {
    try {
      await authApi.resendVerification(email)
      set({ error: null })
      return true
    } catch (err) {
      set({ error: messageFromError(err) })
      return false
    }
  },

  logout: async () => {
    set({ status: 'loading' })
    try {
      await authApi.logout()
    } catch {
      // even if the server call fails, drop the local session (the backend
      // clears the HttpOnly cookies on its side when it can)
    } finally {
      set({ user: null, status: 'unauthenticated', error: null })
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    // статус не трогаем: 'loading' → FullPageSplash, 'unauthenticated' → /login
    try {
      const user = await authApi.changePassword(currentPassword, newPassword)
      set({ user, status: 'authenticated', error: null })
      return true
    } catch (err) {
      set({ error: messageFromError(err) })
      return false
    }
  },

  resetError: () => set({ error: null }),
}))

// Session expires server-side (e.g. refresh token revoked) → force sign out.
setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null, status: 'unauthenticated' })
})
