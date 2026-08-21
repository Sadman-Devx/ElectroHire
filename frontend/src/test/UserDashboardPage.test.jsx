import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getCategories } from '@/services/categoryService'
import { getContactHistory } from '@/services/contactService'
import { getMyRatings } from '@/services/ratingService'

vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))
vi.mock('@/services/contactService', () => ({
  getContactHistory: vi.fn(),
}))
vi.mock('@/services/ratingService', () => ({
  getMyRatings: vi.fn(),
}))

const CATEGORIES = [
  { id: 1, name: 'Electrician', icon: 'bulb' },
  { id: 2, name: 'Plumber', icon: 'pipe' },
]

function buildHistory(count) {
  return Array.from({ length: count }).map((_, index) => ({
    provider_id: index + 1,
    provider_name: `Provider ${index + 1}`,
    provider_area: 'Dhanmondi',
    provider_photo: null,
    contacted_at: '2026-08-12T10:00:00Z',
  }))
}

function buildRatings(count) {
  return Array.from({ length: count }).map((_, index) => ({
    provider_id: index + 1,
    provider_name: `Rated Provider ${index + 1}`,
    rating_value: 5,
    review_text: '',
    tags: [],
    created_at: '2026-08-10',
  }))
}

function renderDashboard(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
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
  getCategories.mockReset()
  getContactHistory.mockReset()
  getMyRatings.mockReset()
  getCategories.mockResolvedValue(CATEGORIES)
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('UserDashboardPage', () => {
  it('redirects an unauthenticated visitor to /login (ProtectedRoute)', async () => {
    renderDashboard()

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('greets the signed-in user by name', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])

    renderDashboard()

    expect(
      await screen.findByRole('heading', { name: /good (morning|afternoon|evening), Mahmudul/i })
    ).toBeInTheDocument()
  })

  it('renders the quick search box with categories from the categories API', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])

    renderDashboard()

    expect(await screen.findByRole('option', { name: 'Electrician' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Plumber' })).toBeInTheDocument()
  })

  it('navigates to /providers with the chosen filters when Search is submitted', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])
    const user = userEvent.setup()

    renderDashboard()
    await screen.findByRole('option', { name: 'Electrician' })

    await user.selectOptions(screen.getByLabelText(/category/i), 'Electrician')
    await user.type(screen.getByLabelText(/area/i), 'Mirpur')
    await user.click(screen.getByRole('button', { name: /search/i }))

    expect(await screen.findByText(/electrician in mirpur/i)).toBeInTheDocument()
  })

  it('shows recently contacted providers and my ratings once both load', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue(buildHistory(2))
    getMyRatings.mockResolvedValue(buildRatings(2))

    renderDashboard()

    expect(await screen.findByText('Recently contacted')).toBeInTheDocument()
    expect(screen.getByText('Provider 1')).toBeInTheDocument()
    expect(screen.getByText('My ratings')).toBeInTheDocument()
    expect(screen.getByText('Rated Provider 1')).toBeInTheDocument()
  })

  it('caps each list at the 5 most recent items', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue(buildHistory(8))
    getMyRatings.mockResolvedValue(buildRatings(8))

    renderDashboard()

    expect(await screen.findByText('Provider 1')).toBeInTheDocument()
    expect(screen.getByText('Provider 5')).toBeInTheDocument()
    expect(screen.queryByText('Provider 6')).not.toBeInTheDocument()

    expect(screen.getByText('Rated Provider 5')).toBeInTheDocument()
    expect(screen.queryByText('Rated Provider 6')).not.toBeInTheDocument()
  })

  it('shows empty states when there is no history or ratings yet', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])

    renderDashboard()

    expect(await screen.findByText(/haven.t contacted any providers yet/i)).toBeInTheDocument()
    expect(screen.getByText(/haven.t rated any providers yet/i)).toBeInTheDocument()
  })

  it('links through to the full account & history page', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])

    renderDashboard()
    await screen.findByText(/haven.t contacted any providers yet/i)

    expect(screen.getByRole('link', { name: /view your full account/i })).toHaveAttribute(
      'href',
      '/account'
    )
  })

  it('renders UserNavbar for a "user" role and DashboardNavbar for a "provider" role', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])

    renderDashboard()
    await screen.findByText(/haven.t contacted any providers yet/i)

    // UserNavbar (Day 9, Dev 1/3 post-launch fix, replacing the public
    // Navbar here) — Dashboard/Messages/Account, no dead marketing
    // anchor links. "Account" matched on the exact name since the page
    // also has its own "View your full account & history" link whose
    // accessible name contains the same word.
    expect(screen.getByRole('link', { name: /messages/i })).toHaveAttribute('href', '/chats')
    expect(screen.getByRole('link', { name: 'Account' })).toHaveAttribute('href', '/account')
  })

  it('renders DashboardNavbar (not UserNavbar) for a "provider" role', async () => {
    loginAsProvider()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])

    renderDashboard()
    await screen.findByText(/haven.t contacted any providers yet/i)

    // DashboardNavbar's own nav links (Chats/Reviews/Profile) — see
    // ProviderDashboardPage.test.jsx for the equivalent assertion.
    expect(screen.getByRole('link', { name: 'Reviews' })).toHaveAttribute(
      'href',
      '/provider/reviews'
    )
  })

  // Day 9, Dev 3 (post-launch addition): CategoryQuickLinks — a fast
  // "jump straight to a category" shortcut, distinct from HomePage's
  // bigger marketing-oriented PopularCategories grid. Links to the
  // exact same /providers?category=<id> shape SearchBox already builds
  // (see pages/ProvidersPage.jsx), so ProvidersPage needs no changes.
  it('shows category quick-jump links that route to /providers?category=<id>', async () => {
    loginAsUser()
    getContactHistory.mockResolvedValue([])
    getMyRatings.mockResolvedValue([])

    renderDashboard()

    const electricianLink = await screen.findByRole('link', { name: /electrician/i })
    expect(electricianLink).toHaveAttribute('href', '/providers?category=1')

    const plumberLink = screen.getByRole('link', { name: /plumber/i })
    expect(plumberLink).toHaveAttribute('href', '/providers?category=2')
  })
})