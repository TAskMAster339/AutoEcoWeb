/**
 * Auth store (Zustand).
 *
 * Holds ONLY the user + status. Raw tokens live in the READONLY cookie
 * (src/lib/cookie.ts) — this store never sees them.
 */
import { create } from 'zustand'
import * as authApi from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import { clearAuthTokens, getRefreshToken, setAuthTokens } from '../lib/cookie'
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
  logout: () => Promise<void>
  resetError: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: 'idle',
  error: null,

  bootstrap: async () => {
    set({ status: 'loading', error: null })
    try {
      const user = await authApi.fetchMe()
      set({ user, status: 'authenticated' })
    } catch {
      // client already attempted a refresh; if it failed, tokens are cleared.
      clearAuthTokens()
      set({ user: null, status: 'unauthenticated' })
    }
  },

  login: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const res = await authApi.login(email, password)
      setAuthTokens(res.access_token, res.refresh_token)
      set({ user: res.user, status: 'authenticated' })
      return true
    } catch (err) {
      set({ status: 'unauthenticated', error: messageFromError(err) })
      return false
    }
  },

  register: async (email, password) => {
    set({ status: 'loading', error: null })
    try {
      const user = await authApi.register(email, password)
      // Backend returns the user but no tokens on register — sign in right after.
      const ok = await get().login(email, password)
      if (!ok) {
        set({ user, status: 'unauthenticated', error: 'Регистрация успешна, но не удалось войти' })
        return false
      }
      return true
    } catch (err) {
      set({ status: 'unauthenticated', error: messageFromError(err) })
      return false
    }
  },

  logout: async () => {
    const refreshToken = getRefreshToken()
    set({ status: 'loading' })
    try {
      if (refreshToken) await authApi.logout(refreshToken)
    } catch {
      // even if the server call fails, drop the local session
    } finally {
      clearAuthTokens()
      set({ user: null, status: 'unauthenticated', error: null })
    }
  },

  resetError: () => set({ error: null }),
}))

// Session expires server-side (e.g. refresh token revoked) → force sign out.
setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null, status: 'unauthenticated' })
})
