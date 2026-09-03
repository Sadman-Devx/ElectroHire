import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Flag, MessageCircle, Phone, Star } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/useAuth'
import { useContactEligibility } from '@/hooks/useContactEligibility'
import { useContactProvider } from '@/hooks/useContactProvider'
import { formatMonthYear } from '@/lib/formatDate'

/**
 * Day 6 spec: "Sticky Contact Card (Chat Button + Call/Number Reveal)"
 * + "Report Button (উপরে বা Footer-এ)" — placed in the card's footer,
 * matching the provided design mock (website_remaining_pages.html,
 * Provider Profile Detail page).
 *
 * "Show Number" still uses POST /api/contacts/ (useContactProvider)
 * because the API Contract creates the ContactLog either way —
 * "Number Reveal করলেও Log তৈরি হবে" — and there's no message content
 * involved in revealing a number.
 *
 * "Send Message" changed again as of the follow-up after Day 9: it
 * used to open an inline composer right here on the profile page and
 * send the first message without ever leaving it (Day 8, Dev 1). Per
 * product feedback, composing on the profile page felt like a
 * dead-end side quest instead of actually starting a conversation —
 * now the button's only job is routing the customer straight into
 * ChatsPage (the same "Messages" page every reply after the first one
 * already lives in), where they type and send. No message is composed
 * or sent from this card anymore; useSendFirstMessage.js (which used
 * to do that) was removed as dead code along with it.
 *
 * The customer hasn't sent anything yet at the point of this
 * navigation, so there's no real conversation for ChatsPage to find
 * in GET /api/contacts/conversations/ (that list only contains
 * threads with at least one Message row — see contacts/views.py
 * ConversationListView). `?providerId=` and `&name=` are carried
 * alongside the existing `?with=<user_id>` convention specifically so
 * ChatsPage can render a conversation shell — provider identity and
 * header, empty thread, ready composer — before any message exists,
 * instead of the empty state a bare `?with=` alone would produce.
 * `name` travels in the URL rather than being re-fetched on the other
 * end purely to avoid an extra round trip on click; it's used for
 * nothing but a header label, so there's no correctness reason to
 * prefer a fresh fetch over what's already sitting in `provider` here.
 * See ChatsPage.jsx's own doc comment for the read side of this.
 *
 * Not logged in → sends the user to /login first (same
 * `state: { from: location }` pattern ProtectedRoute already uses),
 * so they land back here able to retry after signing in.
 *
 * NOTE (contract gap, flagging for the team): GET /api/providers/{id}/
 * doesn't return a phone number field, so "Show Number" can't reveal a
 * real number today. It still creates the contact log per contract,
 * then tells the truth about why no number is shown rather than
 * inventing one. Swap in provider.phone below the moment the contract
 * adds it — nothing else here needs to change.
 *
 * Report links to the real Report Provider Page as of Day 8, Dev 3
 * (route /providers/:id/report) — it used to be a placeholder
 * acknowledgement here because the Report model/API didn't exist
 * until Day 8, Dev 2. Not logged in follows the same requireAuth()
 * redirect the other two actions already use, since that route is
 * itself wrapped in <ProtectedRoute> (see App.jsx) and would bounce
 * to /login anyway — checking here first just avoids the extra hop.
 *
 * "Rate this provider" — Day 9, Dev 1 addition, exactly where
 * RateProviderPage.jsx's own docstring already said it would go
 * ("once wired below") when that page was built on Day 8. Same
 * requireAuth() pattern when logged out. When logged in,
 * useContactEligibility() (new today, backed by the new
 * GET /api/contacts/check/{id}/) decides whether this renders as a
 * real link or a disabled label — RateProviderPage's own eligibility
 * handling (EligibilityNotice) is left in place as the backstop, this
 * is purely a UX improvement that avoids sending an ineligible user
 * to the form to begin with.
 */
function StickyContactCard({ provider }) {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const {
    contact,
    pendingIntent,
    resultIntent,
    error: contactError,
    reset: resetContact,
  } = useContactProvider(provider.id)
  const { hasContacted, isLoading: eligibilityLoading } = useContactEligibility(provider.id)

  function requireAuth() {
    if (isAuthenticated) return true
    navigate('/login', { state: { from: location } })
    return false
  }

  function handleReportClick(event) {
    if (!requireAuth()) {
      event.preventDefault()
    }
  }

  function handleRateClick(event) {
    if (!requireAuth()) {
      event.preventDefault()
    }
  }

  function handleSendMessageClick() {
    if (!requireAuth()) return
    const params = new URLSearchParams({
      with: String(provider.user_id),
      providerId: String(provider.id),
      name: provider.name,
    })
    navigate(`/chats?${params.toString()}`)
  }

  function handleShowNumber() {
    if (!requireAuth()) return
    contact('number')
  }

  function handleBackToOptions() {
    resetContact()
  }

  const memberSince = formatMonthYear(provider.member_since)
  const isNumberRevealed = resultIntent === 'number'
  const isPending = pendingIntent !== null
  // provider.user_id is a Day 8 addition to ProviderDetailSerializer
  // (see that file's docstring) — without it there's no id to route
  // this conversation to, so the button is disabled rather than
  // navigating to a chat that can never resolve to anyone.
  const canMessage = Boolean(provider.user_id)

  return (
    <Card className="p-6 lg:sticky lg:top-24">
      <p className="mb-4 text-sm font-semibold text-[var(--color-text)]">
        Contact {provider.name}
      </p>

      {isNumberRevealed ? (
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
            disabled={isPending || !canMessage}
            onClick={handleSendMessageClick}
            title={canMessage ? undefined : 'Messaging is not available for this provider yet.'}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" /> Send Message
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled={isPending}
            onClick={handleShowNumber}
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

      {contactError ? (
        <p className="mt-3 text-xs font-medium text-[var(--color-danger)]">{contactError}</p>
      ) : null}

      {isNumberRevealed ? (
        <button
          type="button"
          onClick={handleBackToOptions}
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

      <div className="mt-4 flex items-center justify-between border-t border-[var(--color-border)] pt-4">
        {isAuthenticated && (eligibilityLoading || !hasContacted) ? (
          <span
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-subtle)]"
            title={
              eligibilityLoading
                ? undefined
                : `Contact ${provider.name} first to leave a rating`
            }
          >
            <Star className="h-3.5 w-3.5" aria-hidden="true" /> Rate this provider
          </span>
        ) : (
          <Link
            to={`/providers/${provider.id}/rate`}
            onClick={handleRateClick}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-secondary)] hover:underline"
          >
            <Star className="h-3.5 w-3.5" aria-hidden="true" /> Rate this provider
          </Link>
        )}

        <Link
          to={`/providers/${provider.id}/report`}
          onClick={handleReportClick}
          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-danger)] hover:underline"
        >
          <Flag className="h-3.5 w-3.5" aria-hidden="true" /> Report this provider
        </Link>
      </div>
    </Card>
  )
}

export { StickyContactCard }