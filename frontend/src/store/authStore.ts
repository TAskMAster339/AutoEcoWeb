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

  resetError: () => set({ error: null }),
}))

// Session expires server-side (e.g. refresh token revoked) → force sign out.
setUnauthorizedHandler(() => {
  useAuthStore.setState({ user: null, status: 'unauthenticated' })
})
