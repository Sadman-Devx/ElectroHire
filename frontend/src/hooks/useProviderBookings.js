import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/context/useAuth'
import { getProviderBookings } from '@/services/bookingService'

/**
 * Day 11: fetches GET /api/bookings/provider/ on mount, for
 * ProviderBookingsPage. Same shape as useMyBookings — see that hook's
 * doc comment for the full reasoning behind `refetch` (the reload
 * -token pattern), `applyStatusUpdate`, and the StrictMode
 * double-effect guard.
 *
 * Bug fix (found while testing the page's own "you're signed in, but
 * not as a provider" gate): originally fetched unconditionally on
 * mount regardless of the signed-in account's role, which meant a
 * "user"-role visitor's very first render already fired a request to
 * an endpoint the page was about to explain isn't for them at all —
 * wasted, and guaranteed to 404 (see ProviderBookingListView's own
 * docstring). Guards on `user.role === 'provider'` the same way
 * useContactEligibility.js already guards its own fetch on
 * `isAuthenticated` — skip entirely rather than let the page's own
 * role check race a request already in flight.
 *
 *   const { bookings, isLoading, error, refetch, applyStatusUpdate } = useProviderBookings()
 */
export function useProviderBookings() {
  const { user } = useAuth()
  const isProvider = user?.role === 'provider'

  const [bookings, setBookings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const isFetchingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    async function load() {
      // Bail-out branch's setState calls live inside this async
      // function (not directly in the effect body), same
      // react-hooks/set-state-in-effect reasoning
      // useContactEligibility.js's own comment already explains.
      if (!isProvider) {
        if (isMountedRef.current) {
          setBookings([])
          setIsLoading(false)
        }
        return
      }

      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const data = await getProviderBookings()
        if (isMountedRef.current) setBookings(data)
      } catch (err) {
        if (isMountedRef.current) {
          setError(err?.message || 'Could not load your booking requests. Please try again.')
          setBookings([])
        }
      } finally {
        isFetchingRef.current = false
        if (isMountedRef.current) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMountedRef.current = false
      isFetchingRef.current = false
    }
  }, [reloadToken, isProvider])

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  const applyStatusUpdate = useCallback((bookingId, nextStatus) => {
    setBookings((current) =>
      current.map((booking) => (booking.id === bookingId ? { ...booking, status: nextStatus } : booking))
    )
  }, [])

  return { bookings, isLoading, error, refetch, applyStatusUpdate }
}

export default useProviderBookings