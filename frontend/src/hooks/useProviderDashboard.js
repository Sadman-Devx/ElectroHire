import { useEffect, useState } from 'react'

import { getProviderDashboard } from '@/services/providerDashboardService'

/**
 * Fetches GET /api/providers/dashboard/ once on mount. Same
 * loading/error/data shape useProviderDetail() exposes, plus
 * `isAvailable` — separate from `error` — for the 404 this always
 * returns today (Day 6), since the route itself doesn't exist until
 * Day 9, Dev 2. That split lets ProviderDashboardPage show "stats
 * aren't available yet" instead of a scary error banner for the
 * expected case, while still surfacing a real error banner if the
 * endpoint exists later but genuinely fails.
 *
 *   const { dashboard, isLoading, error, isAvailable } = useProviderDashboard()
 */
export function useProviderDashboard() {
  const [dashboard, setDashboard] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAvailable, setIsAvailable] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadDashboard() {
      setIsLoading(true)
      setError(null)
      setIsAvailable(true)

      try {
        const data = await getProviderDashboard()
        if (isMounted) setDashboard(data)
      } catch (err) {
        if (isMounted) {
          if (err?.response?.status === 404) {
            setIsAvailable(false)
          } else {
            setError(
              err?.response?.data?.message || 'Could not load your dashboard. Please try again.'
            )
          }
          setDashboard(null)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadDashboard()

    return () => {
      isMounted = false
    }
  }, [])

  return { dashboard, isLoading, error, isAvailable }
}

export default useProviderDashboard