import { useEffect, useState } from 'react'

import { getProviderDetail } from '@/services/providerService'

/**
 * Fetches GET /api/providers/{id}/ whenever id changes. Same
 * loading/error/data shape useProviders()/useCategories() expose, with
 * one addition: `notFound`, kept separate from `error` so the page can
 * render a distinct "Provider not found" state for the 404 the backend
 * returns (providers/views.py ProviderDetailView) instead of a generic
 * error banner.
 *
 *   const { provider, isLoading, error, notFound } = useProviderDetail(id)
 */
export function useProviderDetail(id) {
  const [provider, setProvider] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadProvider() {
      setIsLoading(true)
      setError(null)
      setNotFound(false)

      try {
        const data = await getProviderDetail(id)
        if (isMounted) setProvider(data)
      } catch (err) {
        if (isMounted) {
          if (err?.response?.status === 404) {
            setNotFound(true)
          } else {
            setError(
              err?.response?.data?.message || 'Could not load this provider. Please try again.'
            )
          }
          setProvider(null)
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    // No defensive "no id" branch here on purpose: the only route that
    // renders this hook (/providers/:id) guarantees a non-empty id, and
    // if that ever weren't true, getProviderDetail(undefined) hits
    // /providers/undefined/, which the backend 404s — already handled
    // as `notFound` above, with no extra branch/lint tradeoff needed.
    loadProvider()

    return () => {
      isMounted = false
    }
  }, [id])

  return { provider, isLoading, error, notFound }
}

export default useProviderDetail