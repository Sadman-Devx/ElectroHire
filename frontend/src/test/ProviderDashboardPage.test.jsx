import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getProviderDashboard } from '@/services/providerDashboardService'

vi.mock('@/services/providerDashboardService', () => ({
  getProviderDashboard: vi.fn(),
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

  it('shows an honest "not available yet" state when the dashboard endpoint 404s (not built until Day 9)', async () => {
    loginAsProvider()
    const error = new Error('Not Found')
    error.response = { status: 404 }
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

  it('shows a real error banner on a non-404 failure', async () => {
    loginAsProvider()
    const error = new Error('Server error')
    error.response = { data: { message: 'Could not load your dashboard. Please try again.' } }
    getProviderDashboard.mockRejectedValue(error)

    renderDashboard()

    expect(await screen.findByText(/could not load your dashboard/i)).toBeInTheDocument()
  })

  it('renders the dashboard navbar with Dashboard/Chats/Reviews/Profile links', async () => {
    loginAsProvider()
    getProviderDashboard.mockResolvedValue(DASHBOARD_DATA)

    renderDashboard()
    await screen.findByRole('heading', { name: /provider dashboard/i })

    expect(screen.getByRole('link', { name: 'Chats' })).toHaveAttribute('href', '/chats')
    expect(screen.getByRole('link', { name: 'Reviews' })).toHaveAttribute('href', '/provider/reviews')
    expect(screen.getByRole('link', { name: 'Profile' })).toHaveAttribute('href', '/provider/profile-setup')
  })
})