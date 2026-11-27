import { useCallback, useEffect, useRef, useState } from 'react'

import { useAuth } from '@/context/useAuth'
import { getWalletSummary } from '@/services/walletService'

/**
 * Fetches GET /api/wallet/ for the signed-in provider: balance, due,
 * available balance, the due limit and the latest few ledger lines.
 *
 * Same shape as useProviderCommission (reload-token refetch, in-flight
 * guard reset on cleanup for StrictMode, skipped for non-provider
 * accounts).
 *
 *   const { wallet, isLoading, error, refetch } = useWallet()
 */
export function useWallet() {
  const { user } = useAuth()
  const isProvider = user?.role === 'provider'

  const [wallet, setWallet] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [reloadToken, setReloadToken] = useState(0)

  const isFetchingRef = useRef(false)
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true

    async function load() {
      if (!isProvider) {
        if (isMountedRef.current) {
          setWallet(null)
          setIsLoading(false)
        }
        return
      }

      if (isFetchingRef.current) return
      isFetchingRef.current = true
      setIsLoading(true)
      setError(null)

      try {
        const data = await getWalletSummary()
        if (isMountedRef.current) setWallet(data)
      } catch (err) {
        if (isMountedRef.current) {
          setError(err?.message || 'Could not load your wallet.')
          setWallet(null)
        }
      } finally {
        isFetchingRef.current = false
        if (isMountedRef.current) setIsLoading(false)
      }
    }

    load()

    return () => {
      isMountedRef.current = false
      isFetchingRef.current = false
    }
  }, [reloadToken, isProvider])

  const refetch = useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  return { wallet, isLoading, error, refetch }
}

export default useWallet