import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getCategories } from '@/services/categoryService'
import { getContactHistory } from '@/services/contactService'
import { getMyRatings } from '@/services/ratingService'
import { getProviderDashboard } from '@/services/providerDashboardService'
import { getMyProviderProfile } from '@/services/providerService'

// Day 9, Dev 1/3: HomePage now bounces an already-authenticated
// visitor straight to their dashboard (see HomePage.jsx), so — same
// reasoning LoginPage.test.jsx documents — the "authenticated" tests
// below render past HomePage into a real destination page and need
// that destination page's own service calls mocked.
vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))
vi.mock('@/services/contactService', () => ({
  getContactHistory: vi.fn(),
}))
vi.mock('@/services/ratingService', () => ({
  getMyRatings: vi.fn(),
}))
vi.mock('@/services/providerDashboardService', () => ({
  getProviderDashboard: vi.fn(),
}))
vi.mock('@/services/providerService', () => ({
  getMyProviderProfile: vi.fn(),
}))

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  getCategories.mockReset()
  getContactHistory.mockReset()
  getMyRatings.mockReset()
  getProviderDashboard.mockReset()
  getMyProviderProfile.mockReset()

  getCategories.mockResolvedValue([{ id: 1, name: 'Electrician', icon: 'bulb' }])
  getContactHistory.mockResolvedValue([])
  getMyRatings.mockResolvedValue([])
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('HomePage', () => {
  it('shows the public marketing hero for an anonymous visitor', async () => {
    renderHome()

    expect(await screen.findByRole('heading', { name: /find a skilled/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^search$/i })).toBeInTheDocument()
  })

  it('redirects a signed-in user to /dashboard instead of the marketing hero', async () => {
    saveSession({ accessToken: 'token-abc', refreshToken: 'refresh-abc', role: 'user', name: 'Mahmudul' })

    renderHome()

    // "Mahmudul" also shows up in the navbar, so scope to the heading
    // role to avoid an ambiguous "found multiple elements" match.
    expect(await screen.findByRole('heading', { name: /mahmudul/i })).toBeInTheDocument()
    expect(screen.getByText(/find a service provider today/i)).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /find a skilled/i })).not.toBeInTheDocument()
  })

  it('redirects a signed-in provider to /provider/dashboard instead of the marketing hero', async () => {
    saveSession({ accessToken: 'token-xyz', refreshToken: 'refresh-xyz', role: 'provider', name: 'Karim Uddin' })
    getProviderDashboard.mockResolvedValue({
      contacts_count: 38,
      ratings_count: 24,
      avg_rating: 4.8,
      recent_messages: [],
    })
    getMyProviderProfile.mockResolvedValue({
      id: 1,
      area: 'Dhanmondi',
      experience: 8,
      description: '',
      photo: null,
      status: 'active',
      categories: [{ id: 1, name: 'Electrician' }],
      verified: true,
    })

    renderHome()

    expect(await screen.findByRole('heading', { name: /provider dashboard/i })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /find a skilled/i })).not.toBeInTheDocument()
  })
})