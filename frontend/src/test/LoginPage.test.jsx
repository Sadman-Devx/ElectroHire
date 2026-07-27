import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <App />
    </MemoryRouter>
  )
}

describe('LoginPage', () => {
  it('shows a validation error for both empty fields on submit', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()
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

  it('logs in successfully with valid-looking credentials and navigates home', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'mahmudul@email.com')
    await user.type(screen.getByLabelText(/^password$/i), 'strongpassword123')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/logging in/i)).toBeInTheDocument()

    // Navigates to the (placeholder) home page
    expect(await screen.findByRole('heading', { name: /home page placeholder/i })).toBeInTheDocument()
  })

  it('shows the mock "Invalid email or password" error for a too-short password', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email address/i), 'mahmudul@email.com')
    await user.type(screen.getByLabelText(/^password$/i), 'short1')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    // LoginPage's client-side check only requires a non-empty password
    // (unlike Signup's 8-char minimum), so 'short1' passes validation
    // here and is rejected by the mock service's server-side check
    // instead — this exercises that error-handling path specifically.
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument()
  })

  it('still shows the signup link and heading', () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: /welcome back/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
  })
})