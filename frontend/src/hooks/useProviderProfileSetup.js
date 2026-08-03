import { useCallback, useState } from 'react'

import { setupProviderProfile } from '@/services/providerService'

/**
 * Wraps POST /api/providers/profile/ in loading/error/data state,
 * adapted for a one-shot mutation: nothing runs until submit() is called.
 *
 *   const { submit, isSubmitting, error, fieldErrors, isSuccess } = useProviderProfileSetup()
 *   const ok = await submit({ categories, area, experience, description, photo })
 */
export function useProviderProfileSetup() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [fieldErrors, setFieldErrors] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const submit = useCallback(async (values) => {
    setIsSubmitting(true)
    setError(null)
    setFieldErrors(null)
    try {
      await setupProviderProfile(values)
      setIsSuccess(true)
      return true
    } catch (err) {
      setError(err.message || 'Could not submit your profile. Please try again.')
      setFieldErrors(err.errors ?? null)
      setIsSuccess(false)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setFieldErrors(null)
    setIsSuccess(false)
  }, [])

  return { submit, isSubmitting, error, fieldErrors, isSuccess, reset }
}

export default useProviderProfileSetup