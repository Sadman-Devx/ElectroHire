import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { resetPassword } from '@/services/authService'

// Only resetPassword is needed — ResetPasswordPage never calls
// login/register/etc, and LoginPage (the page it navigates to on
// success) doesn't call anything on mount, only on its own submit.
vi.mock('@/services/authService', () => ({
  resetPassword: vi.fn(),
}))

function renderResetPassword(email = 'mahmudul@email.com') {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/reset-password', state: { email } }]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

async function fillOtp(user, digits = '123456') {
  // Note: the email field above is *also* a role=textbox (type="email"),
  // so a plain screen.getAllByRole('textbox') would include it as
  // index 0 and shift every OTP digit one box to the right — scope to
  // the OTP group (its own aria-label, same as OtpInput.jsx renders)
  // to only get the six digit boxes.
  const otpGroup = screen.getByRole('group', { name: /6-digit verification code/i })
  const otpInputs = within(otpGroup).getAllByRole('textbox')
  for (let i = 0; i < digits.length; i += 1) {
    await user.type(otpInputs[i], digits[i])
  }
}

beforeEach(() => {
  localStorage.clear()
  resetPassword.mockReset()
})

afterEach(() => {
  localStorage.clear()
})

describe('ResetPasswordPage', () => {
  it('prefills the email from router state but leaves it editable', () => {
    renderResetPassword('karim@email.com')
    expect(screen.getByLabelText(/email address/i)).toHaveValue('karim@email.com')
  })

  it('defaults to a blank email when reached directly with no router state', () => {
    render(
      <MemoryRouter initialEntries={['/reset-password']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    )
    expect(screen.getByLabelText(/email address/i)).toHaveValue('')
  })

  it('shows validation errors for an empty OTP and a too-short password', async () => {
    const user = userEvent.setup()
    renderResetPassword()

    await user.type(screen.getByLabelText(/^new password$/i), 'short')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/enter the 6-digit code/i)).toBeInTheDocument()
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('rejects a new password that does not match its confirmation', async () => {
    const user = userEvent.setup()
    renderResetPassword()

    await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'somethingelse123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(resetPassword).not.toHaveBeenCalled()
  })

  it('resets the password and redirects to /login with a confirmation banner', async () => {
    resetPassword.mockResolvedValue({
      status: 'success',
      message: 'Password has been reset. Please log in.',
    })

    const user = userEvent.setup()
    renderResetPassword('mahmudul@email.com')

    await fillOtp(user)
    await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(resetPassword).toHaveBeenCalledWith({
      email: 'mahmudul@email.com',
      otp: '123456',
      newPassword: 'newpassword123',
    })

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(
      screen.getByText(/password has been reset\. please log in with your new password\./i)
    ).toBeInTheDocument()
  })

  it('shows the backend error message (e.g. expired OTP) and stays on the page', async () => {
    const error = new Error('Invalid or expired OTP')
    error.status = 400
    resetPassword.mockRejectedValue(error)

    const user = userEvent.setup()
    renderResetPassword()

    await fillOtp(user)
    await user.type(screen.getByLabelText(/^new password$/i), 'newpassword123')
    await user.type(screen.getByLabelText(/confirm new password/i), 'newpassword123')
    await user.click(screen.getByRole('button', { name: /reset password/i }))

    expect(await screen.findByText(/invalid or expired otp/i)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument()
  })
})