import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/context/useAuth'
import { getProviderCommission } from '@/services/bookingService'

/**
 * Fetches GET /api/bookings/provider/commission/ for the signed-in
 * provider: current commission rate, how much they owe the platform,
 * whether they're blocked from accepting new bookings, and the jobs
 * making up the balance.
 *
 * Same shape as useProviderBookings (reload-token refetch, in-flight
 * guard reset on cleanup for StrictMode, skip entirely for non-provider
 * accounts). Call `refetch()` after any booking status change — a
 * completed cash job adds to what's owed.
 *
 *   const { summary, isLoading, error, refetch } = useProviderCommission()
 */
export function useProviderCommission() {
  const { user } = useAuth()
  const isProvider = user?.role === 'provider'

  const [summary, setSummary] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const isFetchingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    async function load() {
      if (!isProvider) {
        if (isMountedRef.current) {
          setSummary(null)
          setIsLoading(false)
        }
        return
      }

      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const data = await getProviderCommission()
        if (isMountedRef.current) setSummary(data)
      } catch (err) {
        if (isMountedRef.current) {
          setError(err?.message || 'Could not load your commission summary.')
          setSummary(null)
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

  return { summary, isLoading, error, refetch }
}

export default useProviderCommission