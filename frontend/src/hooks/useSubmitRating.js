import { useCallback, useState } from 'react'

import { submitRating } from '@/services/ratingService'

/**
 * Wraps POST /api/ratings/ in loading/error/success state, same shape
 * as useProviderProfileSetup() — a one-shot mutation, nothing runs
 * until submit() is called.
 *
 * `error` is whatever apiError.js normalized the server's message to
 * — including the eligibility message ("You must contact this
 * provider before rating") when the caller hasn't contacted the
 * provider yet, which pages/RateProviderPage.jsx renders as-is rather
 * than a generic failure banner, since it's actionable (go message
 * the provider first) rather than a real error.
 *
 *   const { submit, isSubmitting, error, isSuccess, reset } = useSubmitRating()
 *   const ok = await submit({ providerId: 1, ratingValue: 4, reviewText: '...', tags: ['on_time'] })
 */
export function useSubmitRating() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)

  const submit = useCallback(async (values) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await submitRating(values)
      setIsSuccess(true)
      return true
    } catch (err) {
      setError(err.message || 'Could not submit your rating. Please try again.')
      setIsSuccess(false)
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

export default useSubmitRating