import { useEffect, useState } from 'react'

import { getProviderDashboard } from '@/services/providerDashboardService'

/**
 * Fetches GET /api/providers/dashboard/ once on mount. Same
 * loading/error/data shape useProviderDetail() exposes, plus
 * `isAvailable` — separate from `error`.
 *
 * Day 9, Dev 2 built the real endpoint (providers/views.py
 * ProviderDashboardView), which returns 403 ("Only providers have a
 * dashboard.") for a signed-in provider who hasn't completed POST
 * /api/providers/profile/ yet — same "no Provider row" condition
 * GET /api/providers/me/ (ProviderMeView) already 403s on, kept
 * consistent here on purpose. That split lets ProviderDashboardPage
 * show "stats aren't available yet" instead of a scary error banner
 * for that expected case, while still surfacing a real error banner
 * for a genuine failure (any other status).
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
          if (err?.response?.status === 403) {
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