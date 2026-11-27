import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/context/useAuth'
import { getWalletTransactions } from '@/services/walletService'

const PAGE_SIZE = 20

/**
 * Paged ledger statement (GET /api/wallet/transactions/). Loads the
 * first page on mount and `loadMore()` appends the next one.
 * `refetch()` reloads from the first page.
 *
 *   const { items, count, hasMore, isLoading, isLoadingMore, error,
 *           loadMore, refetch } = useWalletTransactions()
 */
export function useWalletTransactions() {
  const { user } = useAuth()
  const isProvider = user?.role === 'provider'

  const [items, setItems] = useState([])
  const [count, setCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const isMountedRef = useRef(true)
  const isLoadingMoreRef = useRef(false)
  const itemsLengthRef = useRef(0)

  useEffect(() => {
    isMountedRef.current = true

    async function loadFirstPage() {
      if (!isProvider) {
        if (isMountedRef.current) {
          setItems([])
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      setError(null)
      try {
        const page = await getWalletTransactions({ limit: PAGE_SIZE, offset: 0 })
        if (!isMountedRef.current) return
        itemsLengthRef.current = page.items.length
        setItems(page.items)
        setCount(page.count)
        setHasMore(page.hasMore)
      } catch (err) {
        if (!isMountedRef.current) return
        setError(err?.message || 'Could not load your wallet history.')
        setItems([])
        setHasMore(false)
      } finally {
        if (isMountedRef.current) setIsLoading(false)
      }
    }

    loadFirstPage()

    return () => {
      isMountedRef.current = false
    }
  }, [reloadToken, isProvider])

  const loadMore = useCallback(async () => {
    if (isLoadingMoreRef.current) return
    isLoadingMoreRef.current = true
    setIsLoadingMore(true)
    setError(null)
    try {
      const page = await getWalletTransactions({
        limit: PAGE_SIZE,
        offset: itemsLengthRef.current,
      })
      if (!isMountedRef.current) return
      itemsLengthRef.current += page.items.length
      setItems((current) => [...current, ...page.items])
      setCount(page.count)
      setHasMore(page.hasMore)
    } catch (err) {
      if (isMountedRef.current) setError(err?.message || 'Could not load more.')
    } finally {
      isLoadingMoreRef.current = false
      if (isMountedRef.current) setIsLoadingMore(false)
    }
  }, [])

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return { items, count, hasMore, isLoading, isLoadingMore, error, loadMore, refetch }
}

export default useWalletTransactions