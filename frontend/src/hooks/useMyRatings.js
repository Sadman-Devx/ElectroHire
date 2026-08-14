import { useEffect, useState } from 'react'

import { getMyRatings } from '@/services/ratingService'

/**
 * Day 9, Dev 1: fetches GET /api/ratings/mine/ once on mount, for the
 * User Account Page's "My Ratings" section.
 *
 *   const { ratings, isLoading, error } = useMyRatings()
 */
export function useMyRatings() {
  const [ratings, setRatings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadRatings() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await getMyRatings()
        if (isMounted) setRatings(data)
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Could not load your ratings. Please try again.')
          setRatings([])
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadRatings()

    return () => {
      isMounted = false
    }
  }, [])

  return { ratings, isLoading, error }
}

export default useMyRatings