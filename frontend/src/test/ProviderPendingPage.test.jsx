import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'

function renderPending(initialPath = '/provider/pending') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsProvider() {
  saveSession({
    accessToken: 'token-abc',
    refreshToken: 'refresh-abc',
    role: 'provider',
    name: 'Karim Uddin',
  })
}

function loginAsUser() {
  saveSession({ accessToken: 'token-xyz', refreshToken: 'refresh-xyz', role: 'user', name: 'Mahmudul' })
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  localStorage.clear()
})

describe('ProviderPendingPage', () => {
  it('redirects an unauthenticated visitor to /login (ProtectedRoute)', async () => {
    renderPending()

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('shows the provider-only gate for a signed-in "user" account', async () => {
    loginAsUser()

    renderPending()

    expect(
      await screen.findByRole('heading', { name: /this page is for service providers/i })
    ).toBeInTheDocument()
  })

  it('shows the review status, all four tracker steps, and the 24-48 hour message for a provider', async () => {
    loginAsProvider()

    renderPending()

    expect(await screen.findByRole('heading', { name: /profile under review/i })).toBeInTheDocument()
    // Exact string (not a regex) so this only matches the <strong> node
    // itself, not its parent <p> — both contain the substring "24–48
    // hours", which trips testing-library's "multiple elements found"
    // check when a regex is used instead.
    expect(screen.getByText('24–48 hours')).toBeInTheDocument()

    expect(screen.getByText('Account created')).toBeInTheDocument()
    expect(screen.getByText('Profile completed')).toBeInTheDocument()
    expect(screen.getByText('Admin review')).toBeInTheDocument()
    expect(screen.getByText('Profile goes live')).toBeInTheDocument()
  })

  it('marks "Admin review" as the current step and links to support', async () => {
    loginAsProvider()

    renderPending()
    await screen.findByRole('heading', { name: /profile under review/i })

    const currentStepItem = screen.getByText('Admin review').closest('li')
    expect(currentStepItem).toHaveAttribute('aria-current', 'step')

    const supportLink = screen.getByRole('link', { name: /contact support/i })
    expect(supportLink).toHaveAttribute('href', 'mailto:support@electrohire.app')
  })
})