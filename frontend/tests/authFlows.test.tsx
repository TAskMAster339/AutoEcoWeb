import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { LoginPage } from '../src/pages/LoginPage'
import { theme } from '../src/theme'
import { useAuthStore } from '../src/store/authStore'
import { queryClient } from '../src/lib/querySession'
import { fetchMe } from '../src/api/auth'

const user = { id: '11111111-1111-4111-8111-111111111111', email: 'user@example.com', role: 'user', status: 'active' }
const server = setupServer()
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
afterEach(() => {
  server.resetHandlers()
  useAuthStore.setState({ user: null, status: 'idle', error: null })
  queryClient.clear()
})

describe('auth HTTP flows', () => {
  it('keeps login form values and displays the wait after 429', async () => {
    server.use(http.post('*/api/v1/auth/login', () => HttpResponse.json(
      { detail: 'Слишком много запросов' }, { status: 429, headers: { 'Retry-After': '30' } })))
    render(<ThemeProvider theme={theme}><MemoryRouter><LoginPage /></MemoryRouter></ThemeProvider>)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: user.email } })
    fireEvent.change(screen.getByLabelText(/^Пароль/), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    await screen.findByText(/Повторите через 30 сек/)
    expect((screen.getByLabelText(/email/i) as HTMLInputElement).value).toBe(user.email)
    expect((screen.getByLabelText(/^Пароль/) as HTMLInputElement).value).toBe('password123')
    expect(screen.getByRole('button', { name: 'Войти' })).toBeDefined()
  })

  it('reports incorrect credentials without attempting session refresh', async () => {
    server.use(http.post('*/api/v1/auth/login', () => new HttpResponse(null, { status: 401 })))
    expect(await useAuthStore.getState().login(user.email, 'wrong-password')).toBe(false)
    expect(useAuthStore.getState().error).toBe('Неверный email или пароль')
    expect(useAuthStore.getState().status).toBe('unauthenticated')
  })
  it('submits the real login form, changes route and clears the previous session cache', async () => {
    server.use(http.post('*/api/v1/auth/login', async ({ request }) => {
      expect(await request.json()).toEqual({ email: user.email, password: 'password123' })
      return HttpResponse.json(user)
    }))
    queryClient.setQueryData(['previous-user'], ['private transaction'])
    render(<ThemeProvider theme={theme}><MemoryRouter initialEntries={['/login']}><Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/transactions" element={<p>Операции пользователя</p>} />
    </Routes></MemoryRouter></ThemeProvider>)
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: user.email } })
    fireEvent.change(screen.getByLabelText(/^Пароль/), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }))
    await screen.findByText('Операции пользователя')
    expect(useAuthStore.getState().user?.id).toBe(user.id)
    expect(queryClient.getQueryData(['previous-user'])).toBeUndefined()
  })

  it('keeps temporary bootstrap errors retryable and accepts the next valid response', async () => {
    server.use(http.get('*/api/v1/auth/me', () => new HttpResponse(null, { status: 503 })))
    await useAuthStore.getState().bootstrap()
    expect(useAuthStore.getState().status).toBe('error')
    server.use(http.get('*/api/v1/auth/me', () => HttpResponse.json(user)))
    await useAuthStore.getState().bootstrap()
    await waitFor(() => expect(useAuthStore.getState().status).toBe('authenticated'))
  })

  it('rejects malformed successful auth responses instead of authenticating them', async () => {
    server.use(http.get('*/api/v1/auth/me', () => HttpResponse.json({ ...user, role: 'superuser' })))
    await expect(fetchMe()).rejects.toThrow()
    await useAuthStore.getState().bootstrap()
    expect(useAuthStore.getState().status).toBe('error')
    expect(useAuthStore.getState().user).toBeNull()
  })
})
