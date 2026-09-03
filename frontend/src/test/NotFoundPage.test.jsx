import { afterEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

afterEach(() => {
  localStorage.clear()
})

describe('NotFoundPage', () => {
  it('renders for an unmatched route', async () => {
    renderAt('/this/route/does/not/exist')

    expect(
      await screen.findByRole('heading', { name: /page not found/i })
    ).toBeInTheDocument()
  })

  it('links back to home', async () => {
    renderAt('/nope')

    const homeLink = await screen.findByRole('link', { name: /back to home/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('links to the providers list', async () => {
    renderAt('/nope')

    const providersLink = await screen.findByRole('link', { name: /browse providers/i })
    expect(providersLink).toHaveAttribute('href', '/providers')
  })

  it('does not render for a real route', async () => {
    renderAt('/login')

    expect(screen.queryByText(/page not found/i)).not.toBeInTheDocument()
  })
})