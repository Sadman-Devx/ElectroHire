import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { getSession } from '@/services/tokenStorage'
import { login } from '@/services/authService'
import { getCategories } from '@/services/categoryService'
import { getContactHistory } from '@/services/contactService'
import { getMyRatings } from '@/services/ratingService'
import { getProviderDashboard } from '@/services/providerDashboardService'
import { getMyProviderProfile } from '@/services/providerService'

// The real authService now makes actual axios/HTTP calls, which have
// no business running inside a unit test. Mocking the module lets us
// drive LoginPage -> AuthContext -> authService end-to-end while
// fully controlling what the "backend" returns.
vi.mock('@/services/authService', () => ({
  login: vi.fn(),
  register: vi.fn(),
}))

// Day 9, Dev 1/3: a successful login now navigates straight to
// /dashboard or /provider/dashboard instead of '/' (see LoginPage.jsx),
// so the "logs in successfully" tests below render past LoginPage into
// a real destination page. These are exactly the service calls that
// destination page makes — mocked here the same way each page's own
// test file already mocks them (UserDashboardPage.test.jsx /
// ProviderDashboardPage.test.jsx), so this stays a controlled unit
// test instead of firing real network requests.
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

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  login.mockReset()
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
})

describe('LoginPage', () => {
  it('shows a validation error for both empty fields on submit', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
    // Client-side validation should block the call entirely.
    expect(login).not.toHaveBeenCalled()
  })

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.tab()

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderLogin()

    const passwordInput = screen.getByLabelText(/^password$/i)
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('logs in a user, stores the session, and navigates to their dashboard', async () => {
    let resolveLogin
    login.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveLogin = resolve
        })
    )

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'mahmudul@email.com')
    await user.type(screen.getByLabelText(/^password$/i), 'strongpassword123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/logging in/i)).toBeInTheDocument()

    resolveLogin({
      status: 'success',
      data: {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        role: 'user',
        name: 'Mahmudul Hasan',
      },
    })

    // Day 9: navigates to /dashboard (UserDashboardPage) rather than
    // the public Home page. The greeting itself is time-of-day
    // dependent (getGreeting()), so match on the name inside the
    // heading role instead of the exact greeting word — the name also
    // shows up a second time in the navbar, so scoping to the heading
    // avoids an ambiguous "found multiple elements" match.
    expect(await screen.findByRole('heading', { name: /mahmudul hasan/i })).toBeInTheDocument()
    expect(screen.getByText(/find a service provider today/i)).toBeInTheDocument()

    expect(login).toHaveBeenCalledWith({
      email: 'mahmudul@email.com',
      password: 'strongpassword123',
    })

    // The JWT pair actually made it into localStorage, not just React state.
    expect(getSession()).toEqual({
      accessToken: 'access-123',
      refreshToken: 'refresh-456',
      role: 'user',
      name: 'Mahmudul Hasan',
    })
  })

  it('logs in a provider and navigates to the provider dashboard', async () => {
    login.mockResolvedValue({
      status: 'success',
      data: {
        access_token: 'access-999',
        refresh_token: 'refresh-999',
        role: 'provider',
        name: 'Karim Uddin',
      },
    })
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

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'karim@email.com')
    await user.type(screen.getByLabelText(/^password$/i), 'strongpassword123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(
      await screen.findByRole('heading', { name: /provider dashboard/i })
    ).toBeInTheDocument()

    expect(getSession()).toEqual({
      accessToken: 'access-999',
      refreshToken: 'refresh-999',
      role: 'provider',
      name: 'Karim Uddin',
    })
  })

  it('shows the backend error message and does not navigate on failure', async () => {
    const error = new Error('Invalid email or password')
    error.status = 400
    login.mockRejectedValue(error)

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'mahmudul@email.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
    // Still on the login page.
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(getSession()).toBeNull()
  })

  it('shows the unverified-account error returned by the backend', async () => {
    const error = new Error('Please verify your email before logging in')
    error.status = 403
    login.mockRejectedValue(error)

    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'karim@email.com')
    await user.type(screen.getByLabelText(/^password$/i), 'strongpassword123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(
      await screen.findByText(/please verify your email before logging in/i)
    ).toBeInTheDocument()
  })

  it('still shows the signup link and heading', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })
})