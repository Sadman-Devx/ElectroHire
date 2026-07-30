import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { AuthProvider } from '@/context/AuthContext'
import { useAuth } from '@/context/useAuth'
import { getSession, saveSession } from '@/services/tokenStorage'
import { login } from '@/services/authService'

vi.mock('@/services/authService', () => ({
  login: vi.fn(),
  register: vi.fn(),
}))

// A minimal consumer so we can exercise useAuth() directly, without
// going through any particular page.
function Probe() {
  const { user, isAuthenticated, accessToken, login: doLogin, logout } = useAuth()
  return (
    <div>
      <p data-testid="status">{isAuthenticated ? 'authenticated' : 'guest'}</p>
      <p data-testid="user">{user ? `${user.name} (${user.role})` : 'none'}</p>
      <p data-testid="token">{accessToken ?? 'none'}</p>
      <button onClick={() => doLogin({ email: 'mahmudul@email.com', password: 'strongpassword123' }).catch(() => {})}>
        do-login
      </button>
      <button onClick={logout}>do-logout</button>
    </div>
  )
}

function renderProbe() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  )
}

beforeEach(() => {
  localStorage.clear()
  login.mockReset()
})

afterEach(() => {
  localStorage.clear()
})

describe('AuthContext', () => {
  it('starts logged out when there is no stored session', () => {
    renderProbe()
    expect(screen.getByTestId('status')).toHaveTextContent('guest')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('restores an existing session from localStorage on mount', () => {
    saveSession({
      accessToken: 'existing-token',
      refreshToken: 'existing-refresh',
      role: 'provider',
      name: 'Karim Uddin',
    })

    renderProbe()

    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('Karim Uddin (provider)')
    expect(screen.getByTestId('token')).toHaveTextContent('existing-token')
  })

  it('login() calls the auth service, updates state, and persists the session', async () => {
    login.mockResolvedValue({
      status: 'success',
      data: {
        access_token: 'access-999',
        refresh_token: 'refresh-999',
        role: 'user',
        name: 'Mahmudul Hasan',
      },
    })

    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByText('do-login'))

    expect(await screen.findByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('user')).toHaveTextContent('Mahmudul Hasan (user)')
    expect(getSession().accessToken).toBe('access-999')
  })

  it('login() propagates the error and does not authenticate on failure', async () => {
    login.mockRejectedValue(new Error('Invalid email or password'))

    const user = userEvent.setup()
    renderProbe()

    await user.click(screen.getByText('do-login'))

    // State stays logged out — the page-level components are
    // responsible for surfacing the error message (see LoginPage.test.jsx).
    expect(await screen.findByTestId('status')).toHaveTextContent('guest')
    expect(getSession()).toBeNull()
  })

  it('logout() clears both React state and localStorage', async () => {
    saveSession({ accessToken: 'a', refreshToken: 'r', role: 'user', name: 'X' })

    const user = userEvent.setup()
    renderProbe()
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')

    await user.click(screen.getByText('do-logout'))

    expect(screen.getByTestId('status')).toHaveTextContent('guest')
    expect(getSession()).toBeNull()
  })
})