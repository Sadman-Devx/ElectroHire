import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getCategories } from '@/services/categoryService'
import { getProviders } from '@/services/providerService'

vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))

vi.mock('@/services/providerService', () => ({
  getProviders: vi.fn(),
}))

// Day 9, Dev 1/3: a signed-in user (or provider) landing on '/' now
// redirects straight to their dashboard (HomePage.jsx) — UserNavbar
// or DashboardNavbar, never this Navbar — so rendering these tests at
// '/' would no longer exercise Navbar's own authenticated-link logic
// at all. /providers (ProvidersPage) still renders this exact Navbar
// unconditionally for every role, so that's what these render against
// instead. getProviders() resolves to [] since these tests only care
// about the navbar, not the provider list underneath it.
function renderProvidersPage() {
  return render(
    <MemoryRouter initialEntries={['/providers']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsUser() {
  saveSession({ accessToken: 'token-xyz', refreshToken: 'refresh-xyz', role: 'user', name: 'Mahmudul' })
}

function loginAsProvider() {
  saveSession({
    accessToken: 'token-abc',
    refreshToken: 'refresh-abc',
    role: 'provider',
    name: 'Karim Uddin',
  })
}

beforeEach(() => {
  localStorage.clear()
  getCategories.mockResolvedValue([])
  getProviders.mockResolvedValue({ data: [], count: 0 })
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

/**
 * Regression test for a Day 7, Dev 3 bug found during a pre-deploy
 * audit: the public Navbar's "Messages" link pointed at /messages, a
 * route App.jsx never registers (the Chat Page lives at /chats), so
 * every signed-in customer who clicked it landed on the catch-all
 * "Page not found" screen instead of their conversations. Fixed in
 * components/home/Navbar.jsx; this test pins the correct href so it
 * can't silently regress.
 */
describe('Navbar (providers page)', () => {
  it('shows Log in / Sign up when no one is signed in', async () => {
    renderProvidersPage()

    expect(await screen.findByRole('link', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument()
  })

  it('links "Messages" to /chats (not /messages) for a signed-in user', async () => {
    loginAsUser()

    renderProvidersPage()

    const messagesLink = await screen.findByRole('link', { name: /messages/i })
    expect(messagesLink).toHaveAttribute('href', '/chats')
  })

  // Day 9, Dev 1: the real Account Page existed at /account since Day
  // 3 (protected route) but was never linked from anywhere in the UI
  // until today.
  it('links "Account" to /account for a signed-in user', async () => {
    loginAsUser()

    renderProvidersPage()

    const accountLink = await screen.findByRole('link', { name: 'Account' })
    expect(accountLink).toHaveAttribute('href', '/account')
  })

  it('does not show an Account link when no one is signed in', async () => {
    renderProvidersPage()

    await screen.findByRole('link', { name: /log in/i })
    expect(screen.queryByRole('link', { name: /account/i })).not.toBeInTheDocument()
  })

  // Day 9, Dev 3: /dashboard (user) and /provider/dashboard (provider)
  // both existed already but, same gap the Account link above was
  // added to close, had no link from any page still using this public
  // Navbar until today.
  it('links "Dashboard" to /dashboard for a signed-in user', async () => {
    loginAsUser()

    renderProvidersPage()

    const dashboardLink = await screen.findByRole('link', { name: /dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/dashboard')
  })

  it('links "Dashboard" to /provider/dashboard for a signed-in provider', async () => {
    loginAsProvider()

    renderProvidersPage()

    const dashboardLink = await screen.findByRole('link', { name: /dashboard/i })
    expect(dashboardLink).toHaveAttribute('href', '/provider/dashboard')
  })
})