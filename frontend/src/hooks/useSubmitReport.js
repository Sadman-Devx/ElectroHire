import { useCallback, useState } from 'react'

import { submitReport } from '@/services/reportService'

/**
 * Wraps POST /api/reports/ in loading/error/success state, same shape
 * as useSubmitRating() / useProviderProfileSetup() — a one-shot
 * mutation, nothing runs until submit() is called.
 *
 * On success, `message` carries the backend's own confirmation text
 * ("Report submitted. We will review within 24-48 hours.") so
 * pages/ReportProviderPage.jsx's confirmation screen shows the real
 * server copy instead of a hardcoded duplicate that could drift out
 * of sync with it.
 *
 *   const { submit, isSubmitting, error, isSuccess, message, reset } = useSubmitReport()
 *   const ok = await submit({ reportedId: 1, reportedType: 'provider', reason: 'fake', details: '...' })
 */
export function useSubmitReport() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [message, setMessage] = useState(null)

  const submit = useCallback(async (values) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await submitReport(values)
      setMessage(response?.message || 'Report submitted. We will review within 24-48 hours.')
      setIsSuccess(true)
      return true
    } catch (err) {
      setError(err.message || 'Could not submit your report. Please try again.')
      setIsSuccess(false)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setIsSuccess(false)
    setMessage(null)
  }, [])

  return { submit, isSubmitting, error, isSuccess, message, reset }
}

export default useSubmitReport