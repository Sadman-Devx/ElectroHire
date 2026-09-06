import { useCallback, useEffect, useRef, useState } from 'react'

import { getMyBookings } from '@/services/bookingService'

/**
 * Day 11: fetches GET /api/bookings/mine/ on mount, for
 * MyBookingsPage. Exposes `refetch` (a manual "Refresh" button — a
 * booking's status can change from the *other* party's side at any
 * time, unlike e.g. Contact History which never changes after the
 * fact) and `applyStatusUpdate` (an optimistic local patch, so
 * cancelling a booking updates its badge immediately instead of
 * waiting on a full round trip — same "patch local state after a
 * successful mutation" idea useConversations.js already uses for
 * markThreadRead/applySentMessage, just for one row's `status` field
 * instead of a chat preview).
 *
 * `refetch` bumps a `reloadToken` dependency rather than calling an
 * outside-the-effect async function directly — the fetch itself stays
 * defined *and* called entirely inside the effect body, same shape
 * useContactHistory.js already uses, which is what
 * react-hooks/set-state-in-effect actually wants to see: calling a
 * useCallback-memoized function from inside an effect reads to that
 * lint rule as "an external callback might set state", even though
 * this one is just as effect-local as useContactHistory's. Bumping a
 * token and depending on it is the idiomatic way to get a re-run
 * without tripping that heuristic.
 *
 * Guards against the same React 18/19 StrictMode double-effect race
 * useConversations.js's own comment documents in detail: an
 * in-flight-request ref is reset on cleanup (not just on completion),
 * so the second ("real") mount's fetch isn't silently skipped by the
 * first ("trial") mount's now-abandoned in-flight guard.
 *
 *   const { bookings, isLoading, error, refetch, applyStatusUpdate } = useMyBookings()
 */
export function useMyBookings() {
  const [bookings, setBookings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const isFetchingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    async function load() {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const data = await getMyBookings()
        if (isMountedRef.current) setBookings(data)
      } catch (err) {
        if (isMountedRef.current) {
          setError(err?.message || 'Could not load your bookings. Please try again.')
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
      // See useConversations.js's own cleanup comment for why this
      // in-flight guard is also reset here, not just isMountedRef —
      // without it, StrictMode's dev-only double-mount can leave
      // isLoading stuck true forever.
      isFetchingRef.current = false
    }
  }, [reloadToken])

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

export default useMyBookings