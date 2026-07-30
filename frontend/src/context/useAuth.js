import { useContext } from 'react'

import { AuthContext } from './auth-context'

/**
 * Access the current auth session ({ user, accessToken, isAuthenticated })
 * plus the `login` / `logout` functions, from anywhere inside <AuthProvider>.
 *
 *   const { user, isAuthenticated, login, logout } = useAuth()
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>')
  }
  return context
}