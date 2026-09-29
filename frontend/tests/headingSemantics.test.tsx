import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { PageHeader } from '../src/components/common/PageHeader'
import { Header } from '../src/components/layout/Header'

describe('page heading semantics', () => {
  it('renders PageHeader visual h5 styling as a semantic h1', () => {
    render(<PageHeader title="Конфиденциальность" />)

    expect(screen.getByRole('heading', { level: 1, name: 'Конфиденциальность' })).not.toBeNull()
  })

  it('renders the application page title as h1', () => {
    render(
      <MemoryRouter initialEntries={['/transactions']}>
        <Header />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Таблица' })).not.toBeNull()
  })
})
