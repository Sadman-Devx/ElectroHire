import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderDetail } from '@/services/providerService'

// Same mocking approach ProviderDetailPage.test.jsx already uses —
// only what this page's own hooks touch needs a mock.
vi.mock('@/services/providerService', () => ({
  getProviderDetail: vi.fn(),
}))
vi.mock('@/services/reportService', () => ({
  submitReport: vi.fn(),
}))

const PROVIDER = {
  id: 1,
  name: 'Karim Uddin',
  area: 'Dhanmondi',
  experience: 8,
  photo: null,
  categories: ['Electrician'],
  avg_rating: 4.8,
  review_count: 24,
  status: 'active',
}

function renderReport(initialPath = '/providers/1/report') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsUser() {
  saveSession({ accessToken: 'token-abc', refreshToken: 'refresh-abc', role: 'user', name: 'Mahmudul' })
}

function loginAsProvider() {
  saveSession({ accessToken: 'token-def', refreshToken: 'refresh-def', role: 'provider', name: 'Karim' })
}

beforeEach(() => {
  localStorage.clear()
  getProviderDetail.mockReset()
  getProviderDetail.mockResolvedValue(PROVIDER)
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

// This route is always wrapped in <ProtectedRoute> (see App.jsx), so an
// anonymous visitor is redirected to /login before ReportProviderPage
// ever renders — no "anonymous visitor" navbar case applies here,
// unlike ProvidersPage/ProviderDetailPage which are public routes.
//
// Day 10, Dev 1 bug fix: this page always rendered the public
// marketing Navbar even though every visitor here is guaranteed
// logged-in — dead "#anchor" links plus a duplicate Dashboard/
// Messages/Account/Log out cluster stacked on top (see
// UserNavbar.jsx's docstring). Fixed to pick DashboardNavbar/
// UserNavbar by role, same convention AccountPage.jsx already uses.
describe('ReportProviderPage — navbar by role (Day 10 fix)', () => {
  it('shows UserNavbar, not the public Navbar, for a logged-in user', async () => {
    loginAsUser()
    renderReport()

    expect(await screen.findByRole('link', { name: 'Karim Uddin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^messages$/i })).toHaveAttribute('href', '/chats')
    expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument()
  })

  it('shows DashboardNavbar, not the public Navbar, for a logged-in provider', async () => {
    loginAsProvider()
    renderReport()

    expect(await screen.findByRole('link', { name: 'Karim Uddin' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^reviews$/i })).toHaveAttribute('href', '/provider/reviews')
    expect(screen.queryByText(/how it works/i)).not.toBeInTheDocument()
  })
})