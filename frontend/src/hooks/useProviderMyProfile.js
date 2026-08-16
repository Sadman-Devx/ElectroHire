import { useEffect, useState } from 'react'

import { getMyProviderProfile } from '@/services/providerService'

/**
 * Fetches GET /api/providers/me/ once on mount. Same loading/error/data
 * shape useProviderDetail()/useProviderDashboard() already establish,
 * plus `isSetUp` — separate from `error`, same split reasoning
 * useProviderDashboard() documents for its own `isAvailable` flag —
 * for the 403 a caller with no Provider row yet always gets back
 * (providers/views.py ProviderMeView). That split lets a page show an
 * honest "you haven't set this up yet" state instead of a scary error
 * banner for the expected case, while still surfacing a real error
 * banner if the endpoint genuinely fails.
 *
 * Two call sites (Day 9, Dev 3): ProviderProfileEditPage (needs the
 * full loading/error/isSetUp trio to drive its own page states) and
 * ProviderDashboardPage (only reads `profile`, ignores the rest — its
 * header badge simply renders nothing until `profile` resolves).
 *
 *   const { profile, isLoading, error, isSetUp } = useProviderMyProfile()
 */
export function useProviderMyProfile() {
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isSetUp, setIsSetUp] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      setIsLoading(true)
      setError(null)
      setIsSetUp(true)

      try {
        const data = await getMyProviderProfile()
        if (isMounted) setProfile(data)
      } catch (err) {
        if (isMounted) {
          if (err?.response?.status === 403) {
            setIsSetUp(false)
          } else {
            setError(
              err?.response?.data?.message || 'Could not load your profile. Please try again.'
            )
          }
          setProfile(null)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadProfile()

    return () => {
      isMounted = false
    }
  }, [])

  return { profile, isLoading, error, isSetUp }
}

export default useProviderMyProfile