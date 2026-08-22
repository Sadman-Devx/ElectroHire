import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession, getSession } from '@/services/tokenStorage'
import { getMyProfile } from '@/services/authService'
import { getMyRatings } from '@/services/ratingService'
import { getContactHistory } from '@/services/contactService'

// Day 9, Dev 1: three new, independent GET endpoints back this page
// (not in the API Contract PDF — see each service function's own
// docstring). Mocked separately, same approach
// ProviderDashboardPage.test.jsx already uses for its one combined
// endpoint, so each test can control (or fail) one section without
// affecting the others.
vi.mock('@/services/authService', () => ({
  getMyProfile: vi.fn(),
}))
vi.mock('@/services/ratingService', () => ({
  getMyRatings: vi.fn(),
}))
vi.mock('@/services/contactService', () => ({
  getContactHistory: vi.fn(),
}))

const PROFILE = {
  id: 1,
  name: 'Mahmudul Hasan',
  email: 'mahmudul@email.com',
  phone: '01712345678',
  role: 'user',
  verified: true,
  member_since: '2024-01-15',
}

const RATINGS = [
  {
    provider_id: 1,
    provider_name: 'Karim Uddin',
    rating_value: 5,
    review_text: 'Very professional, came on time!',
    tags: ['on_time', 'professional'],
    created_at: '2026-08-10',
  },
]

const HISTORY = [
  {
    provider_id: 1,
    provider_name: 'Karim Uddin',
    provider_area: 'Dhanmondi',
    provider_photo: null,
    contacted_at: '2026-08-12T10:00:00Z',
  },
]

function renderAccount(initialPath = '/account') {
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
  getMyProfile.mockReset()
  getMyRatings.mockReset()
  getContactHistory.mockReset()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('AccountPage', () => {
  it('redirects an unauthenticated visitor to /login (ProtectedRoute)', async () => {
    renderAccount()

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('renders profile info, ratings and contact history once all three load', async () => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockResolvedValue(RATINGS)
    getContactHistory.mockResolvedValue(HISTORY)

    renderAccount()

    expect(await screen.findByRole('heading', { name: /my account/i })).toBeInTheDocument()

    // Profile Info
    expect(await screen.findByText('mahmudul@email.com')).toBeInTheDocument()
    expect(screen.getByText('01712345678')).toBeInTheDocument()
    expect(screen.getByText(/verified/i)).toBeInTheDocument()

    // My Ratings
    expect(screen.getByText('Very professional, came on time!')).toBeInTheDocument()
    expect(screen.getByText('On time')).toBeInTheDocument()

    // Contact History
    expect(screen.getAllByText('Karim Uddin').length).toBeGreaterThan(0)
    expect(screen.getByText('Dhanmondi')).toBeInTheDocument()
  })

  it('shows an empty state for ratings and contact history when both are empty', async () => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockResolvedValue([])
    getContactHistory.mockResolvedValue([])

    renderAccount()

    expect(await screen.findByText(/haven.t rated any providers yet/i)).toBeInTheDocument()
    expect(screen.getByText(/haven.t contacted any providers yet/i)).toBeInTheDocument()
  })

  it('shows a real error message when a section fails without breaking the rest of the page', async () => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockRejectedValue(new Error('Could not load your ratings. Please try again.'))
    getContactHistory.mockResolvedValue(HISTORY)

    renderAccount()

    expect(await screen.findByText(/could not load your ratings/i)).toBeInTheDocument()
    // Profile + contact history still render despite the ratings failure.
    expect(screen.getByText('mahmudul@email.com')).toBeInTheDocument()
    expect(screen.getAllByText('Karim Uddin').length).toBeGreaterThan(0)
  })

  it('links Terms & Conditions to /terms', async () => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockResolvedValue([])
    getContactHistory.mockResolvedValue([])

    renderAccount()
    await screen.findByRole('heading', { name: /my account/i })

    // Day 10, Dev 1: the site Footer now also links to /terms (see
    // Footer.jsx), so AccountPage legitimately renders it twice —
    // once in its own settings list, once from the shared Footer.
    const termsLinks = screen.getAllByRole('link', { name: /terms.{1,3}conditions/i })
    expect(termsLinks.length).toBeGreaterThanOrEqual(1)
    termsLinks.forEach((link) => expect(link).toHaveAttribute('href', '/terms'))
  })

  it('logs the user out and clears the stored session when Log out is clicked', async () => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockResolvedValue([])
    getContactHistory.mockResolvedValue([])
    const user = userEvent.setup()

    renderAccount()
    await screen.findByRole('heading', { name: /my account/i })

    // Both the navbar and the account page itself render a "Log out"
    // button (same as ProviderDashboardPage's DashboardNavbar +
    // account settings card would) — either one calls the same
    // logout(), so clicking the last match (the account page's own
    // button) is equivalent to clicking either.
    const logoutButtons = screen.getAllByRole('button', { name: /log out/i })
    await user.click(logoutButtons[logoutButtons.length - 1])

    expect(await screen.findByRole('button', { name: /^log in$/i })).toBeInTheDocument()
    expect(getSession()).toBeNull()
  })

  it('renders the dashboard navbar for a signed-in provider instead of the public navbar', async () => {
    loginAsProvider()
    getMyProfile.mockResolvedValue({ ...PROFILE, role: 'provider', name: 'Karim Uddin' })
    getMyRatings.mockResolvedValue([])
    getContactHistory.mockResolvedValue([])

    renderAccount()
    await screen.findByRole('heading', { name: /my account/i })

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'href',
      '/provider/dashboard'
    )
  })
})