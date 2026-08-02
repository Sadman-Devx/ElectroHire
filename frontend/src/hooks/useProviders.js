import { useEffect, useState } from 'react'

import { getProviders } from '@/services/providerService'

/**
 * Fetches GET /api/providers/ whenever category/area/sort change, and
 * exposes the same loading/error/data shape useCategories() does, so
 * ProvidersPage reads exactly like HomePage does.
 *
 *   const { providers, count, isLoading, error } = useProviders({ category, area, sort })
 */
export function useProviders({ category, area, sort }) {
  const [providers, setProviders] = useState([])
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadProviders() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await getProviders({ category, area, sort })
        if (isMounted) {
          setProviders(result.data)
          setCount(result.count)
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err?.response?.data?.message || 'Could not load providers. Please try again.'
          )
          setProviders([])
          setCount(0)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadProviders()

    return () => {
      isMounted = false
    }
  }, [category, area, sort])

  return { providers, count, isLoading, error }
}

export default useProviders