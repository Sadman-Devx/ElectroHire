import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession, getSession } from '@/services/tokenStorage'
import { getMyProfile, deleteAccount, changePassword } from '@/services/authService'
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
  deleteAccount: vi.fn(),
  changePassword: vi.fn(),
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
  deleteAccount.mockReset()
  changePassword.mockReset()
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

  it('links My Bookings to /bookings', async () => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockResolvedValue([])
    getContactHistory.mockResolvedValue([])

    renderAccount()
    await screen.findByRole('heading', { name: /my account/i })

    expect(screen.getByRole('link', { name: /my bookings/i })).toHaveAttribute('href', '/bookings')
  })
})

// Day 11: Delete account — DELETE /api/auth/account/ via
// DeleteAccountSection.jsx / useDeleteAccount.js.
describe('AccountPage — Delete account', () => {
  beforeEach(() => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockResolvedValue([])
    getContactHistory.mockResolvedValue([])
  })

  async function openDeleteDialog(user) {
    renderAccount()
    await screen.findByRole('heading', { name: /my account/i })
    await user.click(screen.getByRole('button', { name: /delete my account/i }))
    expect(await screen.findByRole('heading', { name: /delete your account\?/i })).toBeInTheDocument()
  }

  it('opens a confirmation dialog asking for the current password', async () => {
    const user = userEvent.setup()
    await openDeleteDialog(user)

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('shows a validation error and does not call the API for an empty password', async () => {
    const user = userEvent.setup()
    await openDeleteDialog(user)

    await user.click(screen.getByRole('button', { name: /^delete account$/i }))

    // Exact string match, not a loose /enter your current password/i
    // regex — the Dialog's own description sentence ("Enter your
    // current password to confirm. This cannot be undone.") contains
    // the same words as the field's validation error, so a substring
    // match would ambiguously hit both.
    expect(await screen.findByText('Enter your current password to confirm')).toBeInTheDocument()
    expect(deleteAccount).not.toHaveBeenCalled()
  })

  it('deletes the account, clears the session, and redirects to the home page', async () => {
    deleteAccount.mockResolvedValue({ status: 'success', message: 'Account deleted' })
    const user = userEvent.setup()
    await openDeleteDialog(user)

    await user.type(screen.getByLabelText(/current password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /^delete account$/i }))

    expect(deleteAccount).toHaveBeenCalledWith({ password: 'correct-password' })

    // Session cleared (useDeleteAccount calls AuthContext's logout()
    // internally) and redirected all the way to the public Home page.
    expect(await screen.findByRole('button', { name: /^log in$/i })).toBeInTheDocument()
    expect(getSession()).toBeNull()
  })

  it('shows the backend error (e.g. wrong password) and keeps the dialog open without logging out', async () => {
    const error = new Error('Incorrect password')
    error.status = 400
    deleteAccount.mockRejectedValue(error)
    const user = userEvent.setup()
    await openDeleteDialog(user)

    await user.type(screen.getByLabelText(/current password/i), 'wrong-password')
    await user.click(screen.getByRole('button', { name: /^delete account$/i }))

    expect(await screen.findByText(/incorrect password/i)).toBeInTheDocument()
    // Still signed in — the dialog is still open with the account intact.
    expect(screen.getByRole('heading', { name: /delete your account\?/i })).toBeInTheDocument()
    expect(getSession()).not.toBeNull()
  })

  it('closes the dialog without deleting when Cancel is clicked', async () => {
    const user = userEvent.setup()
    await openDeleteDialog(user)

    await user.type(screen.getByLabelText(/current password/i), 'correct-password')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.queryByRole('heading', { name: /delete your account\?/i })).not.toBeInTheDocument()
    expect(deleteAccount).not.toHaveBeenCalled()
  })
})

// Day 12: Change Password — POST /api/auth/change-password/ via
// ChangePasswordSection.jsx / useChangePassword.js.
describe('AccountPage — Change password', () => {
  beforeEach(() => {
    loginAsUser()
    getMyProfile.mockResolvedValue(PROFILE)
    getMyRatings.mockResolvedValue([])
    getContactHistory.mockResolvedValue([])
  })

  async function openChangePasswordDialog(user) {
    renderAccount()
    await screen.findByRole('heading', { name: /my account/i })
    await user.click(screen.getByRole('button', { name: /^change password$/i }))
    expect(await screen.findByRole('heading', { name: /change your password/i })).toBeInTheDocument()
  }

  it('opens a dialog asking for the current and new password', async () => {
    const user = userEvent.setup()
    await openChangePasswordDialog(user)

    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^new password$/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/confirm new password/i)).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('shows validation errors and does not call the API for empty fields', async () => {
    const user = userEvent.setup()
    await openChangePasswordDialog(user)

    await user.click(screen.getByRole('button', { name: /^update password$/i }))

    expect(await screen.findByText('Enter your current password to confirm')).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('rejects a new password that does not match its confirmation', async () => {
    const user = userEvent.setup()
    await openChangePasswordDialog(user)

    await user.type(screen.getByLabelText(/current password/i), 'oldpassword123')
    await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'somethingelse123')
    await user.click(screen.getByRole('button', { name: /^update password$/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })

  it('changes the password and shows a success state without logging out', async () => {
    changePassword.mockResolvedValue({ status: 'success', message: 'Password changed successfully' })
    const user = userEvent.setup()
    await openChangePasswordDialog(user)

    await user.type(screen.getByLabelText(/current password/i), 'oldpassword123')
    await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /^update password$/i }))

    expect(changePassword).toHaveBeenCalledWith({
      currentPassword: 'oldpassword123',
      newPassword: 'newpassword123',
    })
    expect(await screen.findByText(/your password has been changed successfully/i)).toBeInTheDocument()

    // Still signed in — changing password never clears the session.
    expect(getSession()).not.toBeNull()

    await user.click(screen.getByRole('button', { name: /^done$/i }))
    expect(screen.queryByRole('heading', { name: /change your password|password changed/i })).not.toBeInTheDocument()
  })

  it('shows the backend error (e.g. wrong current password) and keeps the dialog open', async () => {
    const error = new Error('Current password is incorrect')
    error.status = 400
    changePassword.mockRejectedValue(error)
    const user = userEvent.setup()
    await openChangePasswordDialog(user)

    await user.type(screen.getByLabelText(/current password/i), 'wrong-password')
    await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /^update password$/i }))

    expect(await screen.findByText(/current password is incorrect/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /change your password/i })).toBeInTheDocument()
  })

  it('closes the dialog without submitting when Cancel is clicked', async () => {
    const user = userEvent.setup()
    await openChangePasswordDialog(user)

    await user.type(screen.getByLabelText(/current password/i), 'oldpassword123')
    await user.click(screen.getByRole('button', { name: /^cancel$/i }))

    expect(screen.queryByRole('heading', { name: /change your password/i })).not.toBeInTheDocument()
    expect(changePassword).not.toHaveBeenCalled()
  })
})