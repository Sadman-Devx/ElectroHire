import { useCallback, useState } from 'react'

import { createContact } from '@/services/contactService'

/**
 * Wraps POST /api/contacts/ in loading/error/result state, adapted for
 * a one-shot mutation the same way useProviderProfileSetup() wraps
 * POST /api/providers/profile/ — nothing runs until contact() is called.
 *
 * `intent` is caller-defined ('message' | 'number') and just gets
 * echoed back as `resultIntent` on success, so a single sticky contact
 * card can drive two buttons (Send Message / Show Number) off one
 * shared "create the contact log" call — per the API Contract, either
 * action creates the same ContactLog entry — while still knowing which
 * one the user actually clicked, to show the right follow-up UI.
 *
 *   const { contact, pendingIntent, resultIntent, error, reset } = useContactProvider(providerId)
 *   await contact('message')
 */
export function useContactProvider(providerId) {
  const [pendingIntent, setPendingIntent] = useState(null)
  const [resultIntent, setResultIntent] = useState(null)
  const [error, setError] = useState(null)

  const contact = useCallback(
    async (intent) => {
      setPendingIntent(intent)
      setError(null)
      try {
        await createContact({ providerId })
        setResultIntent(intent)
        return true
      } catch (err) {
        // The Contact API (Dev 2, Day 6) may not be registered yet if
        // this page loads before that endpoint lands — a 404 here means
        // "not built yet", not "this provider doesn't want messages".
        setError(
          err.status === 404
            ? "Contacting providers isn't available yet — please check back soon."
            : err.message || 'Could not reach this provider. Please try again.'
        )
        return false
      } finally {
        setPendingIntent(null)
      }
    },
    [providerId]
  )

  const reset = useCallback(() => {
    setResultIntent(null)
    setError(null)
  }, [])

  return { contact, pendingIntent, resultIntent, error, reset }
}

export default useContactProvider