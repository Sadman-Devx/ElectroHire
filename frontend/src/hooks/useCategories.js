import { useEffect, useState } from 'react'

import { getCategories } from '@/services/categoryService'

/**
 * Fetches /api/categories/ once on mount and exposes the three states
 * every consumer needs (loading / error / data), so Hero's dropdown
 * and PopularCategories' grid don't each duplicate this fetch.
 *
 *   const { categories, isLoading, error } = useCategories()
 */
export function useCategories() {
  const [categories, setCategories] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadCategories() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getCategories()
        if (isMounted) setCategories(data)
      } catch (err) {
        if (isMounted) {
          setError(
            err?.response?.data?.message || 'Could not load categories. Please try again.'
          )
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadCategories()

    return () => {
      isMounted = false
    }
  }, [])

  return { categories, isLoading, error }
}

export default useCategories