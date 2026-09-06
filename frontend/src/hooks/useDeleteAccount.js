import { useCallback, useState } from 'react'

import { deleteAccount } from '@/services/authService'
import { useAuth } from '@/context/useAuth'

/**
 * Wraps DELETE /api/auth/account/ in loading/error state, same
 * one-shot-mutation shape useSubmitReport()/useSubmitRating() already
 * use — nothing runs until confirm() is called.
 *
 * On success, immediately calls AuthContext's logout() to clear the
 * now-worthless local session (the account row — and the JWT's
 * subject — no longer exists server-side; see authService.deleteAccount's
 * own docstring). The caller (DeleteAccountSection) is responsible for
 * navigating away afterwards — this hook only owns the mutation +
 * session cleanup, not routing.
 *
 *   const { confirm, isSubmitting, error, reset } = useDeleteAccount()
 *   const ok = await confirm({ password: 'current-password' })
 *   if (ok) navigate('/', { replace: true })
 */
export function useDeleteAccount() {
  const { logout } = useAuth()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const confirm = useCallback(
    async ({ password }) => {
      setIsSubmitting(true)
      setError(null)
      try {
        await deleteAccount({ password })
        logout()
        return true
      } catch (err) {
        setError(err.message || 'Could not delete your account. Please try again.')
        return false
      } finally {
        setIsSubmitting(false)
      }
    },
    [logout]
  )

  const reset = useCallback(() => {
    setError(null)
  }, [])

  return { confirm, isSubmitting, error, reset }
}

export default useDeleteAccount