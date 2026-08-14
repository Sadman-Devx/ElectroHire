import { useEffect, useState } from 'react'

import { getMyProfile } from '@/services/authService'

/**
 * Day 9, Dev 1: fetches GET /api/auth/me/ once on mount, for the
 * User Account Page's "Profile Info" section.
 *
 * Same loading/error/data shape useProviderDetail()/useProviderDashboard()
 * already established — one hook, one concern, page composes them.
 *
 *   const { profile, isLoading, error } = useMyProfile()
 */
export function useMyProfile() {
  const [profile, setProfile] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadProfile() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await getMyProfile()
        if (isMounted) setProfile(data)
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Could not load your profile. Please try again.')
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

  return { profile, isLoading, error }
}

export default useMyProfile