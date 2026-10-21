import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppErrorBoundary } from '../src/components/common/AppErrorBoundary'
import { RouteErrorPage } from '../src/components/common/RouteErrorPage'

afterEach(() => vi.restoreAllMocks())

describe('application error boundaries', () => {
  it('recovers a transient render failure without a white screen', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let shouldThrow = true

    function FlakyView() {
      if (shouldThrow) throw new Error('temporary render failure')
      return <div>Восстановлено</div>
    }

    render(
      <AppErrorBoundary>
        <FlakyView />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert')).not.toBeNull()
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }))
    expect(screen.getByText('Восстановлено')).not.toBeNull()
  })

  it('renders the route-level fallback for a route render error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    function BrokenRoute() {
      throw new Error('broken route')
    }
    const router = createMemoryRouter([
      {
        path: '/',
        element: <BrokenRoute />,
        errorElement: <RouteErrorPage />,
      },
    ])

    render(<RouterProvider router={router} />)

    expect(await screen.findByRole('heading', { name: 'Не удалось открыть страницу' }))
      .not.toBeNull()
    expect(screen.getByRole('button', { name: 'Перезагрузить' })).not.toBeNull()
  })
})
