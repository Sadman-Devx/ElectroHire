import { useCallback, useState } from 'react'

import { updateBookingStatus } from '@/services/bookingService'

/**
 * Wraps PATCH /api/bookings/{id}/status/ in loading/error state.
 * Shared by MyBookingsPage (customer cancels) and ProviderBookingsPage
 * (provider confirms with a quote / rejects / completes).
 *
 * Tracks *which* booking rows are mid-update as a Set rather than one
 * shared boolean, so only the row actually being updated is disabled.
 *
 * `updateStatus` resolves to:
 *   - the server's `data` object on success (truthy — for a provider it
 *     carries the commission fields the transition just set), or `true`
 *     if the server sent no body,
 *   - `false` on failure (message in `error`).
 * Existing callers that only do `if (ok)` keep working unchanged.
 *
 *   const { updateStatus, isPending, error } = useUpdateBookingStatus()
 *   const result = await updateStatus({ bookingId: 7, status: 'confirmed', quotedPrice: '1500' })
 *   if (result) applyStatusUpdate(7, 'confirmed', typeof result === 'object' ? result : {})
 */
export function useUpdateBookingStatus() {
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const [error, setError] = useState(null)

  const updateStatus = useCallback(async ({ bookingId, status: nextStatus, quotedPrice }) => {
    setPendingIds((current) => {
      const next = new Set(current)
      next.add(bookingId)
      return next
    })
    setError(null)

    try {
      const result = await updateBookingStatus({ bookingId, status: nextStatus, quotedPrice })
      return result ?? true
    } catch (err) {
      setError(err.message || 'Could not update this booking. Please try again.')
      return false
    } finally {
      setPendingIds((current) => {
        const next = new Set(current)
        next.delete(bookingId)
        return next
      })
    }
  }, [])

  const isPending = useCallback((bookingId) => pendingIds.has(bookingId), [pendingIds])

  return { updateStatus, isPending, error }
}

export default useUpdateBookingStatus