import { useEffect, useState } from 'react'

import { useAuth } from '@/context/useAuth'
import { checkContactEligibility } from '@/services/contactService'

/**
 * Day 9, Dev 1: "Contact Log Eligibility Check (Rating Button
 * Enable/Disable)".
 *
 * Calls GET /api/contacts/check/{provider_id}/ (new today — see
 * contacts/views.py ContactCheckView) so ProviderDetailPage can show
 * the "Rate this provider" entry point as enabled or disabled *before*
 * the user opens the rating form, instead of only finding out from a
 * 400 on submit (RateProviderPage already handles that failure
 * gracefully too — this hook is a UX improvement on top of that
 * existing fallback, not a replacement for it).
 *
 * Deliberately does nothing (no request, `hasContacted: false`) when
 * logged out — the check endpoint requires auth, and an unauthenticated
 * visitor gets funneled to /login on click the same way the existing
 * "Report this provider" link already does (see StickyContactCard),
 * so there's nothing useful to pre-fetch for them yet.
 *
 *   const { hasContacted, isLoading } = useContactEligibility(provider.id)
 */
export function useContactEligibility(providerId) {
  const { isAuthenticated } = useAuth()
  const [hasContacted, setHasContacted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function loadEligibility() {
      // Bail-out branch's setState calls live inside this async
      // function (not directly in the effect body) to match the
      // react-hooks/set-state-in-effect rule the rest of this
      // project's hooks already satisfy (see useProviderDetail.js) —
      // calling setState synchronously at the top of an effect body
      // itself risks a cascading render; nesting it one function
      // deeper avoids that.
      if (!isAuthenticated || !providerId) {
        if (isMounted) {
          setHasContacted(false)
          setIsLoading(false)
        }
        return
      }

      setIsLoading(true)
      try {
        const data = await checkContactEligibility(providerId)
        if (isMounted) setHasContacted(Boolean(data.has_contacted))
      } catch {
        // Fails closed (button stays disabled) — a transient network
        // error here shouldn't let someone past a rule the backend
        // still enforces anyway; RateProviderPage's own eligibility
        // handling is the real backstop regardless.
        if (isMounted) setHasContacted(false)
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadEligibility()

    return () => {
      isMounted = false
    }
  }, [providerId, isAuthenticated])

  return { hasContacted, isLoading }
}

export default useContactEligibility