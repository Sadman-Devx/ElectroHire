import { useEffect, useState } from 'react'

import { getContactHistory } from '@/services/contactService'

/**
 * Day 9, Dev 1: fetches GET /api/contacts/history/ once on mount, for
 * the User Account Page's "Contact History" section.
 *
 *   const { history, isLoading, error } = useContactHistory()
 */
export function useContactHistory() {
  const [history, setHistory] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    async function loadHistory() {
      setIsLoading(true)
      setError(null)

      try {
        const data = await getContactHistory()
        if (isMounted) setHistory(data)
      } catch (err) {
        if (isMounted) {
          setError(err?.message || 'Could not load your contact history. Please try again.')
          setHistory([])
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadHistory()

    return () => {
      isMounted = false
    }
  }, [])

  return { history, isLoading, error }
}

export default useContactHistory