import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { getSession } from '@/services/tokenStorage'
import { login } from '@/services/authService'

// The real authService now makes actual axios/HTTP calls, which have
// no business running inside a unit test. Mocking the module lets us
// drive LoginPage -> AuthContext -> authService end-to-end while
// fully controlling what the "backend" returns.
vi.mock('@/services/authService', () => ({
  login: vi.fn(),
  register: vi.fn(),
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

  it('logs in successfully, stores the session, and navigates home', async () => {
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

    // Navigates to the (placeholder) home page, which now shows the
    // logged-in state driven by AuthContext.
    expect(await screen.findByRole('heading', { name: /find a skilled/i })).toBeInTheDocument()
    expect(screen.getByText(/mahmudul hasan/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()

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