import { useCallback, useState } from 'react'

import { updateBookingStatus } from '@/services/bookingService'

/**
 * Wraps PATCH /api/bookings/{id}/status/ in loading/error state.
 * Shared by MyBookingsPage (customer cancels) and ProviderBookingsPage
 * (provider confirms/rejects/completes) — same mutation, two very
 * different sets of allowed target statuses (enforced backend-side by
 * BookingStatusUpdateView, not duplicated here).
 *
 * Tracks *which* booking rows are mid-update as a Set rather than one
 * shared boolean, deliberately — a plain `isSubmitting` boolean would
 * let a second row's button re-enable (and be clickable) the instant
 * a first row's request settles even while that first request is
 * still technically in flight from the visitor's point of view,
 * because both rows share the same page and could plausibly be
 * clicked in quick succession. `isPending(bookingId)` only disables
 * the specific row actually being updated.
 *
 *   const { updateStatus, isPending, error } = useUpdateBookingStatus()
 *   const ok = await updateStatus({ bookingId: 7, status: 'cancelled' })
 *   if (ok) applyStatusUpdate(7, 'cancelled') // from useMyBookings/useProviderBookings
 */
export function useUpdateBookingStatus() {
  const [pendingIds, setPendingIds] = useState(() => new Set())
  const [error, setError] = useState(null)

  const updateStatus = useCallback(async ({ bookingId, status: nextStatus }) => {
    setPendingIds((current) => {
      const next = new Set(current)
      next.add(bookingId)
      return next
    })
    setError(null)

    try {
      await updateBookingStatus({ bookingId, status: nextStatus })
      return true
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