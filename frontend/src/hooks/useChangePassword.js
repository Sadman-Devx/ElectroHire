import { useCallback, useState } from 'react'

import { changePassword } from '@/services/authService'

/**
 * Wraps POST /api/auth/change-password/ in loading/error/success
 * state, same one-shot-mutation shape useDeleteAccount() uses.
 *
 * Unlike useDeleteAccount, this never touches the local session —
 * the backend deliberately leaves the current access/refresh token
 * pair working after a change (see authService.changePassword's own
 * docstring), so there's no logout()/navigate() side effect for this
 * hook to own. The caller (ChangePasswordSection) just shows a
 * success state and closes its own dialog.
 *
 *   const { submit, isSubmitting, error, isSuccess, reset } = useChangePassword()
 *   const ok = await submit({ currentPassword, newPassword })
 */
export function useChangePassword() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const submit = useCallback(async ({ currentPassword, newPassword }) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await changePassword({ currentPassword, newPassword })
      setIsSuccess(true)
      return true
    } catch (err) {
      setError(err.message || 'Could not change your password. Please try again.')
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setIsSuccess(false)
  }, [])

  return { submit, isSubmitting, error, isSuccess, reset }
}

export default useChangePassword