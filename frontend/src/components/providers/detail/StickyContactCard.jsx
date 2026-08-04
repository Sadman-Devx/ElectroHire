import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Flag, MessageCircle, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/useAuth'
import { useContactProvider } from '@/hooks/useContactProvider'
import { formatMonthYear } from '@/lib/formatDate'

/**
 * Day 6 spec: "Sticky Contact Card (Chat Button + Call/Number Reveal)"
 * + "Report Button (উপরে বা Footer-এ)" — placed in the card's footer,
 * matching the provided design mock (website_remaining_pages.html,
 * Provider Profile Detail page).
 *
 * Both buttons share one POST /api/contacts/ call (useContactProvider)
 * because the API Contract creates the same ContactLog entry either
 * way — "Number Reveal করলেও Log তৈরি হবে". Not logged in → sends the
 * user to /login first (same `state: { from: location }` pattern
 * ProtectedRoute already uses), so they land back here with an intact
 * intent to retry after signing in.
 *
 * NOTE (contract gap, flagging for the team): GET /api/providers/{id}/
 * doesn't return a phone number field, so "Show Number" can't reveal a
 * real number today. It still creates the contact log per contract,
 * then tells the truth about why no number is shown rather than
 * inventing one. Swap in provider.phone below the moment the contract
 * adds it — nothing else here needs to change.
 *
 * Report is a placeholder acknowledgement, not a real submission — the
 * Report model/API don't exist until Day 8, Dev 2.
 */
function StickyContactCard({ provider }) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { contact, pendingIntent, resultIntent, error, reset } = useContactProvider(provider.id)
  const [isReportOpen, setIsReportOpen] = useState(false)

  function handleContactClick(intent) {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: location } })
      return
    }
    contact(intent)
  }

  const memberSince = formatMonthYear(provider.member_since)
  const isPending = pendingIntent !== null

  return (
    <Card className="p-6 lg:sticky lg:top-24">
      <p className="mb-4 text-sm font-semibold text-[var(--color-text)]">
        Contact {provider.name}
      </p>

      {resultIntent === 'message' ? (
        <div
          role="status"
          className="rounded-[var(--radius-input)] bg-[var(--color-success)]/10 p-3 text-sm text-[var(--color-success)]"
        >
          Your message request has been sent. {provider.name} will be notified.
        </div>
      ) : resultIntent === 'number' ? (
        <div
          role="status"
          className="rounded-[var(--radius-input)] bg-[var(--color-secondary-tint)] p-3 text-sm text-[var(--color-secondary)]"
        >
          {provider.phone
            ? `Call ${provider.name}: ${provider.phone}`
            : `We've let ${provider.name} know you're interested. A direct number isn't shared yet — send a message instead.`}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Button
            type="button"
            className="w-full"
            disabled={isPending}
            onClick={() => handleContactClick('message')}
          >
            {pendingIntent === 'message' ? (
              <>
                <Spinner /> Sending…
              </>
            ) : (
              <>
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> Send Message
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isPending}
            onClick={() => handleContactClick('number')}
          >
            {pendingIntent === 'number' ? (
              <>
                <Spinner /> Revealing…
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" aria-hidden="true" /> Show Number
              </>
            )}
          </Button>
        </div>
      )}

      {error ? (
        <p className="mt-3 text-xs font-medium text-[var(--color-danger)]">{error}</p>
      ) : null}

      {resultIntent ? (
        <button
          type="button"
          onClick={reset}
          className="mt-3 text-xs font-medium text-[var(--color-secondary)] hover:underline"
        >
          Back to contact options
        </button>
      ) : null}

      {memberSince ? (
        <div className="mt-4 flex justify-between border-t border-[var(--color-border)] pt-4 text-sm text-[var(--color-text-muted)]">
          <span>Member since</span>
          <span className="font-medium text-[var(--color-text)]">{memberSince}</span>
        </div>
      ) : null}

      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
        {isReportOpen ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            Thanks for letting us know. Reporting isn&rsquo;t open yet, but this will be reviewed
            once it is.
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setIsReportOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)] hover:underline"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Report this provider
          </button>
        )}
      </div>
    </Card>
  )
}

export { StickyContactCard }