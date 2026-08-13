import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import App from '@/App'
import { AuthProvider } from '@/context/AuthContext'
import { saveSession } from '@/services/tokenStorage'
import { getCategories } from '@/services/categoryService'

vi.mock('@/services/categoryService', () => ({
  getCategories: vi.fn(),
}))

function renderHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  )
}

function loginAsUser() {
  saveSession({ accessToken: 'token-xyz', refreshToken: 'refresh-xyz', role: 'user', name: 'Mahmudul' })
}

beforeEach(() => {
  localStorage.clear()
  getCategories.mockResolvedValue([])
})

afterEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

/**
 * Regression test for a Day 7, Dev 3 bug found during a pre-deploy
 * audit: the public Navbar's "Messages" link pointed at /messages, a
 * route App.jsx never registers (the Chat Page lives at /chats), so
 * every signed-in customer who clicked it landed on the catch-all
 * "Page not found" screen instead of their conversations. Fixed in
 * components/home/Navbar.jsx; this test pins the correct href so it
 * can't silently regress.
 */
describe('Navbar (home page)', () => {
  it('shows Log in / Sign up when no one is signed in', async () => {
    renderHome()

    expect(await screen.findByRole('link', { name: /log in/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /messages/i })).not.toBeInTheDocument()
  })

  it('links "Messages" to /chats (not /messages) for a signed-in user', async () => {
    loginAsUser()

    renderHome()

    const messagesLink = await screen.findByRole('link', { name: /messages/i })
    expect(messagesLink).toHaveAttribute('href', '/chats')
  })
})