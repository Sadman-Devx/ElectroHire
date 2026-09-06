import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { forgotPassword } from '@/services/authService'

// Only forgotPassword is needed here — ForgotPasswordPage never calls
// login/register/etc, and LoginPage (reachable via "Back to log in")
// doesn't call anything on mount, only on its own submit. Same
// "mock only what this file's flow actually calls" convention
// LoginPage.test.jsx already uses.
vi.mock('@/services/authService', () => ({
  forgotPassword: vi.fn(),
}))

function renderForgotPassword() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

beforeEach(() => {
  localStorage.clear()
  forgotPassword.mockReset()
})

afterEach(() => {
  localStorage.clear()
})

describe('ForgotPasswordPage', () => {
  it('shows a validation error for an empty email on submit', async () => {
    const user = userEvent.setup()
    renderForgotPassword()

    await user.click(screen.getByRole('button', { name: /send reset code/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(forgotPassword).not.toHaveBeenCalled()
  })

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByLabelText(/email address/i), 'not-an-email')
    await user.tab()

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument()
  })

  it('shows the confirmation panel and continues to Reset Password with the email prefilled', async () => {
    forgotPassword.mockResolvedValue({
      status: 'success',
      message: 'If an account exists for this email, a password reset code has been sent',
    })

    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByLabelText(/email address/i), 'Mahmudul@Email.com')
    await user.click(screen.getByRole('button', { name: /send reset code/i }))

    expect(await screen.findByRole('heading', { name: /check your email/i })).toBeInTheDocument()
    expect(forgotPassword).toHaveBeenCalledWith({ email: 'mahmudul@email.com' })

    await user.click(screen.getByRole('button', { name: /enter the code/i }))

    expect(await screen.findByRole('heading', { name: /reset your password/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email address/i)).toHaveValue('mahmudul@email.com')
  })

  it('shows the backend error message on a genuine request failure', async () => {
    const error = new Error('Something went wrong. Please try again.')
    error.status = 500
    forgotPassword.mockRejectedValue(error)

    const user = userEvent.setup()
    renderForgotPassword()

    await user.type(screen.getByLabelText(/email address/i), 'mahmudul@email.com')
    await user.click(screen.getByRole('button', { name: /send reset code/i }))

    expect(await screen.findByText(/something went wrong\. please try again\./i)).toBeInTheDocument()
    // Still on the form, not the confirmation panel.
    expect(screen.getByRole('heading', { name: /forgot your password/i })).toBeInTheDocument()
  })

  it('links back to the login page', async () => {
    const user = userEvent.setup()
    renderForgotPassword()

    await user.click(screen.getByRole('link', { name: /back to log in/i }))

    expect(await screen.findByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
  })
})