import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderDashboard } from '@/services/providerDashboardService'
import { getMyProviderProfile } from '@/services/providerService'

vi.mock('@/services/providerDashboardService', () => ({
  getProviderDashboard: vi.fn(),
}))

vi.mock('@/services/providerService', () => ({
  getMyProviderProfile: vi.fn(),
}))

const DASHBOARD_DATA = {
  contacts_count: 38,
  ratings_count: 24,
  avg_rating: 4.8,
  recent_messages: [
    { id: 1, sender_name: 'Mahmudul Hasan', content: 'AC er kaj lagbe...', is_read: false },
    { id: 2, sender_name: 'Rahim Ahmed', content: 'Kal ashen please', is_read: true },
  ],
}

function renderDashboard(initialPath = '/provider/dashboard') {
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
  getProviderDashboard.mockReset()
  getMyProviderProfile.mockReset()
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ProviderDashboardPage', () => {
  it('redirects an unauthenticated visitor to /login (ProtectedRoute)', async () => {
    renderDashboard()

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })

  it('shows the provider-only gate for a signed-in "user" account', async () => {
    loginAsUser()
    renderDashboard()

    expect(
      await screen.findByRole('heading', { name: /this page is for service providers/i })
    ).toBeInTheDocument()
  })

  it('shows an honest "not available yet" state for a provider with no profile yet (403)', async () => {
    loginAsProvider()
    const error = new Error('Forbidden')
    error.response = { status: 403 }
    getProviderDashboard.mockRejectedValue(error)

    renderDashboard()

    expect(await screen.findByRole('heading', { name: /provider dashboard/i })).toBeInTheDocument()
    expect(screen.getAllByText('—')).toHaveLength(3)
    expect(screen.getAllByText('Coming soon')).toHaveLength(3)
    expect(screen.getByText(/messages aren.t available here yet/i)).toBeInTheDocument()
  })

  it('renders real stats and recent messages once the dashboard API returns data', async () => {
    loginAsProvider()
    getProviderDashboard.mockResolvedValue(DASHBOARD_DATA)

    renderDashboard()

    expect(await screen.findByText('38')).toBeInTheDocument()
    expect(screen.getByText('24')).toBeInTheDocument()
    expect(screen.getByText('4.8')).toBeInTheDocument()

    expect(screen.getByText('Mahmudul Hasan')).toBeInTheDocument()
    expect(screen.getByText('AC er kaj lagbe...')).toBeInTheDocument()
    expect(screen.getByText('Rahim Ahmed')).toBeInTheDocument()
  })

  it('shows an empty state when the provider has no messages yet', async () => {
    loginAsProvider()
    getProviderDashboard.mockResolvedValue({ ...DASHBOARD_DATA, recent_messages: [] })

    renderDashboard()

    expect(await screen.findByText('No messages yet')).toBeInTheDocument()
  })

  it('shows a real error banner on a non-403 failure', async () => {
    loginAsProvider()
    const error = new Error('Server error')
    error.response = { status: 500, data: { message: 'Could not load your dashboard. Please try again.' } }
    getProviderDashboard.mockRejectedValue(error)

    renderDashboard()

    expect(await screen.findByText(/could not load your dashboard/i)).toBeInTheDocument()
  })

  it('shows the Verified and status badges plus an Edit profile link once GET /api/providers/me/ resolves', async () => {
    loginAsProvider()
    getProviderDashboard.mockResolvedValue(DASHBOARD_DATA)
    getMyProviderProfile.mockResolvedValue({
      id: 1,
      area: 'Dhanmondi',
      experience: 8,
      description: '',
      photo: null,
      status: 'active',
      categories: [],
      verified: true,
    })

    renderDashboard()

    expect(await screen.findByText('Verified')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit profile' })).toHaveAttribute(
      'href',
      '/provider/profile-edit'
    )
  })

  it('does not show a Verified badge for an unverified pending provider', async () => {
    loginAsProvider()
    getProviderDashboard.mockResolvedValue(DASHBOARD_DATA)
    getMyProviderProfile.mockResolvedValue({
      id: 1,
      area: 'Dhanmondi',
      experience: 1,
      description: '',
      photo: null,
      status: 'pending',
      categories: [],
      verified: false,
    })

    renderDashboard()

    expect(await screen.findByText('Pending review')).toBeInTheDocument()
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
  })

  it('renders no badge and no Edit profile link before the profile fetch resolves', async () => {
    loginAsProvider()
    getProviderDashboard.mockResolvedValue(DASHBOARD_DATA)
    getMyProviderProfile.mockRejectedValue(Object.assign(new Error('Forbidden'), {
      response: { status: 403 },
    }))

    renderDashboard()

    await screen.findByRole('heading', { name: /provider dashboard/i })
    expect(screen.queryByText('Verified')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit profile' })).not.toBeInTheDocument()
  })

  it('renders the dashboard navbar with Dashboard/Chats/Reviews/Profile links', async () => {
    loginAsProvider()
    getProviderDashboard.mockResolvedValue(DASHBOARD_DATA)

    renderDashboard()
    await screen.findByRole('heading', { name: /provider dashboard/i })

    expect(screen.getByRole('link', { name: 'Chats' })).toHaveAttribute('href', '/chats')
    expect(screen.getByRole('link', { name: 'Reviews' })).toHaveAttribute('href', '/provider/reviews')
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/provider/profile-edit')
  })
})