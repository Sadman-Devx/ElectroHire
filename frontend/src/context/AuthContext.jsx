import { useCallback, useMemo, useState } from 'react'

import { login as loginRequest } from '@/services/authService'
import { clearSession, getSession, saveSession } from '@/services/tokenStorage'
import { AuthContext } from './auth-context'

function AuthProvider({ children }) {
  // Lazy initializer: on first mount, restore whatever session was
  // already persisted from a previous visit (Day 3 requirement — the
  // token lives in localStorage, not just in memory, so a page
  // refresh doesn't silently log the user out).
  const [session, setSession] = useState(() => getSession())

  const login = useCallback(async (credentials) => {
    const response = await loginRequest(credentials)
    const { access_token: accessToken, refresh_token: refreshToken, role, name } =
      response.data

    const nextSession = saveSession({ accessToken, refreshToken, role, name })
    setSession(nextSession)
    return nextSession
  }, [])

  const logout = useCallback(() => {
    clearSession()
    setSession(null)
  }, [])

  const value = useMemo(() => {
    const isAuthenticated = Boolean(session?.accessToken)
    return {
      // `user` is null when logged out so consumers can do a simple
      // `if (user)` check instead of reaching into a maybe-null session.
      user: isAuthenticated ? { role: session.role, name: session.name } : null,
      accessToken: session?.accessToken ?? null,
      isAuthenticated,
      login,
      logout,
    }
  }, [session, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }