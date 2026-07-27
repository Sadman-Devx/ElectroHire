import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'

function renderSignup() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <App />
    </MemoryRouter>
  )
}

async function fillValidForm(user) {
  await user.click(screen.getByRole('radio', { name: /i need a service/i }))
  await user.type(screen.getByLabelText(/full name/i), 'Mahmudul Hasan')
  await user.type(screen.getByLabelText(/email address/i), 'mahmudul@email.com')
  await user.type(screen.getByLabelText(/phone number/i), '01712345678')
  await user.type(screen.getByLabelText(/^password$/i), 'strongpassword123')
}

describe('SignupPage', () => {
  it('renders both role cards, unselected by default', () => {
    renderSignup()
    const userCard = screen.getByRole('radio', { name: /i need a service/i })
    const providerCard = screen.getByRole('radio', { name: /i offer a service/i })
    expect(userCard).toHaveAttribute('aria-checked', 'false')
    expect(providerCard).toHaveAttribute('aria-checked', 'false')
  })

  it('highlights a role card on click and unhighlights the other', async () => {
    const user = userEvent.setup()
    renderSignup()

    const userCard = screen.getByRole('radio', { name: /i need a service/i })
    const providerCard = screen.getByRole('radio', { name: /i offer a service/i })

    await user.click(userCard)
    expect(userCard).toHaveAttribute('aria-checked', 'true')
    expect(providerCard).toHaveAttribute('aria-checked', 'false')

    await user.click(providerCard)
    expect(providerCard).toHaveAttribute('aria-checked', 'true')
    expect(userCard).toHaveAttribute('aria-checked', 'false')
  })

  it('shows a validation error for every empty field on submit, and does not navigate', async () => {
    const user = userEvent.setup()
    renderSignup()

    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/choose whether you need a service/i)).toBeInTheDocument()
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/email is required/i)).toBeInTheDocument()
    expect(screen.getByText(/phone number is required/i)).toBeInTheDocument()
    expect(screen.getByText(/password is required/i)).toBeInTheDocument()

    // still on the signup page, not navigated away
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })

  it('does not show errors before the user has touched a field or submitted', () => {
    renderSignup()
    expect(screen.queryByText(/name is required/i)).not.toBeInTheDocument()
  })

  it('rejects an invalid phone number format', async () => {
    const user = userEvent.setup()
    renderSignup()

    const phoneInput = screen.getByLabelText(/phone number/i)
    await user.type(phoneInput, '12345')
    await user.tab() // blur to trigger the touched state

    expect(
      await screen.findByText(/enter a valid bangladeshi mobile number/i)
    ).toBeInTheDocument()
  })

  it('rejects a password under 8 characters', async () => {
    const user = userEvent.setup()
    renderSignup()

    await user.type(screen.getByLabelText(/^password$/i), 'short1')
    await user.tab()

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    const user = userEvent.setup()
    renderSignup()

    const passwordInput = screen.getByLabelText(/^password$/i)
    expect(passwordInput).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(passwordInput).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('submits successfully with valid data and navigates to the OTP step', async () => {
    const user = userEvent.setup()
    renderSignup()

    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /create account/i }))

    // Button shows the loading state
    expect(await screen.findByText(/creating account/i)).toBeInTheDocument()

    // Then navigates to the (placeholder) verify-otp page, carrying the email
    expect(await screen.findByRole('heading', { name: /account created/i })).toBeInTheDocument()
    expect(screen.getByText(/mahmudul@email\.com/i)).toBeInTheDocument()
  })

  it('shows the mock "Email already exists" error without navigating away', async () => {
    const user = userEvent.setup()
    renderSignup()

    await fillValidForm(user)
    await user.clear(screen.getByLabelText(/email address/i))
    await user.type(screen.getByLabelText(/email address/i), 'taken@example.com')

    await user.click(screen.getByRole('button', { name: /create account/i }))

    expect(await screen.findByText(/email already exists/i)).toBeInTheDocument()
    // still on signup, not navigated to verify-otp
    expect(screen.getByRole('heading', { name: /create your account/i })).toBeInTheDocument()
  })
})