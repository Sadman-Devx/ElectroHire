import { useCallback, useState } from 'react'

import { createBooking } from '@/services/bookingService'

/**
 * Wraps POST /api/bookings/ in loading/error/success state, same
 * shape as useSubmitReport() / useSubmitRating() — a one-shot
 * mutation, nothing runs until submit() is called.
 *
 * On success, `data` carries the created booking (id, provider_name,
 * scheduled_date, scheduled_time, status — see
 * BookingCreateResponseSerializer) so BookProviderPage's confirmation
 * screen can show the real scheduled date/time back to the customer
 * without a second GET.
 *
 *   const { submit, isSubmitting, error, isSuccess, data, reset } = useSubmitBooking()
 *   const ok = await submit({
 *     providerId, categoryId, scheduledDate, scheduledTime, address, description,
 *   })
 */
export function useSubmitBooking() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [data, setData] = useState(null)

  const submit = useCallback(async (values) => {
    setIsSubmitting(true)
    setError(null)
    try {
      const response = await createBooking(values)
      setData(response)
      setIsSuccess(true)
      return true
    } catch (err) {
      setError(err.message || 'Could not send your booking request. Please try again.')
      setIsSuccess(false)
      return false
    } finally {
      setIsSubmitting(false)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setIsSuccess(false)
    setData(null)
  }, [])

  return { submit, isSubmitting, error, isSuccess, data, reset }
}

export default useSubmitBooking