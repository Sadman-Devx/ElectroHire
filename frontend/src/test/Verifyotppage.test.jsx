import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { getSession } from '@/services/tokenStorage'
import { resendOtp, verifyOtp } from '@/services/authService'
import { getCategories } from '@/services/categoryService'
import { getContactHistory } from '@/services/contactService'
import { getMyRatings } from '@/services/ratingService'
import { getMyProviderProfile } from '@/services/providerService'

// Same reasoning as LoginPage.test.jsx: mock the real network-calling
// service so VerifyOtpPage -> AuthContext.completeOtpVerification can
// be driven end-to-end without an actual backend.
vi.mock('@/services/authService', () => ({
  verifyOtp: vi.fn(),
  resendOtp: vi.fn(),
}))

// VerifyOtpPage navigates straight into a real destination page on
// success (UserDashboardPage for a user, ProviderProfileSetupPage for
// a provider) — these are exactly the service calls those two pages
// make, mocked the same way their own test files already do.
vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))
vi.mock('@/services/contactService', () => ({
  getContactHistory: vi.fn(),
}))
vi.mock('@/services/ratingService', () => ({
  getMyRatings: vi.fn(),
}))
vi.mock('@/services/providerService', () => ({
  getMyProviderProfile: vi.fn(),
}))

function renderVerifyOtp(email = 'mahmudul@email.com') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/verify-otp', state: { email } }]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  verifyOtp.mockReset()
  resendOtp.mockReset()
  getCategories.mockReset()
  getContactHistory.mockReset()
  getMyRatings.mockReset()
  getMyProviderProfile.mockReset()

  getCategories.mockResolvedValue([{ id: 1, name: 'Electrician', icon: 'bulb' }])
  getContactHistory.mockResolvedValue([])
  getMyRatings.mockResolvedValue([])
})

afterEach(() => {
  localStorage.clear()
})

describe('VerifyOtpPage', () => {
  it('redirects to /signup when no email was passed via navigation state', () => {
    render(
      <MemoryRouter initialEntries={['/verify-otp']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )

    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })

  it('shows the email address the code was sent to', () => {
    renderVerifyOtp('karim@email.com')
    expect(screen.getByText('karim@email.com')).toBeInTheDocument()
  })

  // Day 10, Dev 1 bug fix: a verified *user* (not provider) account
  // used to navigate to '/' first, relying on HomePage's own
  // authenticated-visitor bounce to reach '/dashboard' a beat later.
  // Not broken, but an unnecessary extra redirect hop / visible flash
  // of the public Home page. Now goes straight there, same as a fresh
  // login already does.
  it('verifies a user account and navigates straight to /dashboard', async () => {
    verifyOtp.mockResolvedValue({
      status: 'success',
      message: 'Account verified',
      data: { access_token: 'access-1', refresh_token: 'refresh-1', role: 'user' },
    })

    const user = userEvent.setup()
    renderVerifyOtp('mahmudul@email.com')

    const otpInputs = screen.getAllByRole('textbox')
    for (let i = 0; i < 6; i += 1) {
      await user.type(otpInputs[i], String((i + 1) % 10))
    }
    await user.click(screen.getByRole('button', { name: /verify account/i }))

    expect(
      await screen.findByRole('heading', { name: /good (morning|afternoon|evening)/i })
    ).toBeInTheDocument()

    expect(getSession()).toEqual({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      role: 'user',
      name: null,
    })
  })

  it('verifies a provider account and navigates to profile setup, not /dashboard', async () => {
    verifyOtp.mockResolvedValue({
      status: 'success',
      message: 'Account verified',
      data: { access_token: 'access-2', refresh_token: 'refresh-2', role: 'provider' },
    })

    const user = userEvent.setup()
    renderVerifyOtp('karim@email.com')

    const otpInputs = screen.getAllByRole('textbox')
    for (let i = 0; i < 6; i += 1) {
      await user.type(otpInputs[i], String((i + 1) % 10))
    }
    await user.click(screen.getByRole('button', { name: /verify account/i }))

    expect(
      await screen.findByRole('heading', { name: /complete your provider profile/i })
    ).toBeInTheDocument()
  })

  it('shows an error and stays on the page for an invalid OTP', async () => {
    const error = new Error('Invalid or expired OTP')
    error.status = 400
    verifyOtp.mockRejectedValue(error)

    const user = userEvent.setup()
    renderVerifyOtp()

    const otpInputs = screen.getAllByRole('textbox')
    for (let i = 0; i < 6; i += 1) {
      await user.type(otpInputs[i], '9')
    }
    await user.click(screen.getByRole('button', { name: /verify account/i }))

    expect(await screen.findByText(/invalid or expired otp/i)).toBeInTheDocument()
    expect(getSession()).toBeNull()
  })
})