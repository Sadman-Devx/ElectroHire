import { useCallback, useEffect, useMemo, useState } from 'react'

import { login as loginRequest } from '@/services/authService'
import { SESSION_EXPIRED_EVENT } from '@/services/apiClient'
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

  // Day 9, Dev 1: apiClient.js dispatches this when a 401 survives a
  // refresh attempt (refresh token itself expired/invalid — see its
  // response interceptor). apiClient already cleared localStorage at
  // that point; this listener is what actually flips isAuthenticated
  // to false for any already-mounted component, since React state
  // doesn't know localStorage changed underneath it otherwise.
  useEffect(() => {
    function handleSessionExpired() {
      setSession(null)
    }

    window.addEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleSessionExpired)
  }, [])

  const completeOtpVerification = useCallback(({ accessToken, refreshToken, role, name = null }) => {
  const nextSession = saveSession({ accessToken, refreshToken, role, name })
  setSession(nextSession)
  return nextSession
}, [])

const value = useMemo(() => {
  const isAuthenticated = Boolean(session?.accessToken)
  return {
    user: isAuthenticated ? { role: session.role, name: session.name } : null,
    accessToken: session?.accessToken ?? null,
    isAuthenticated,
    login,
    logout,
    completeOtpVerification,
  }
}, [session, login, logout, completeOtpVerification])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export { AuthProvider }