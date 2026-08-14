import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Flag, MessageCircle, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/useAuth'
import { useContactProvider } from '@/hooks/useContactProvider'
import { useSendFirstMessage } from '@/hooks/useSendFirstMessage'
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
 * "Send Message" changed as of the Day 8, Dev 1 follow-up: it used to
 * just log a contact and show a static "sent" banner with no real
 * message and no way to actually reach a conversation — a dead end
 * once the real Chat Page (ChatsPage.jsx) existed to receive it. Now
 * it opens an inline composer and calls the *real*
 * chatService.sendMessage() (the same call the Chat Page itself
 * makes, via useSendFirstMessage), which auto-creates the ContactLog
 * as a side effect (MessageListCreateView.post(), get_or_create) — so
 * there's nothing left for the old POST /api/contacts/ call to do for
 * this intent. On success it links straight into
 * /chats?with=<provider.user_id>, where a real conversation now
 * exists to open (provider.user_id is a Day 8 addition to
 * ProviderDetailSerializer — see that file's docstring).
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
  const { send, isSending, error: sendError, reset: resetSend } = useSendFirstMessage(provider.id)

  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [messageText, setMessageText] = useState('')
  const [sentMessage, setSentMessage] = useState(null)

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

  function handleOpenComposer() {
    if (!requireAuth()) return
    setIsComposerOpen(true)
  }

  async function handleSendSubmit(event) {
    event.preventDefault()
    const trimmed = messageText.trim()
    if (!trimmed) return
    const created = await send(trimmed)
    if (created) {
      setSentMessage(trimmed)
      setIsComposerOpen(false)
      setMessageText('')
    }
  }

  function handleShowNumber() {
    if (!requireAuth()) return
    contact('number')
  }

  function handleBackToOptions() {
    setSentMessage(null)
    setIsComposerOpen(false)
    setMessageText('')
    resetSend()
    resetContact()
  }

  const memberSince = formatMonthYear(provider.member_since)
  const isNumberRevealed = resultIntent === 'number'
  const isPending = pendingIntent !== null || isSending
  const showBackLink = Boolean(sentMessage) || isNumberRevealed

  return (
    <Card className="p-6 lg:sticky lg:top-24">
      <p className="mb-4 text-sm font-semibold text-[var(--color-text)]">
        Contact {provider.name}
      </p>

      {sentMessage ? (
        <div
          role="status"
          className="rounded-[var(--radius-input)] bg-[var(--color-success)]/10 p-3 text-sm text-[var(--color-success)]"
        >
          Your message has been sent to {provider.name}.
          {provider.user_id ? (
            <>
              {' '}
              <Link to={`/chats?with=${provider.user_id}`} className="font-semibold underline">
                Open the conversation
              </Link>
            </>
          ) : null}
        </div>
      ) : isNumberRevealed ? (
        <div
          role="status"
          className="rounded-[var(--radius-input)] bg-[var(--color-secondary-tint)] p-3 text-sm text-[var(--color-secondary)]"
        >
          {provider.phone
            ? `Call ${provider.name}: ${provider.phone}`
            : `We've let ${provider.name} know you're interested. A direct number isn't shared yet — send a message instead.`}
        </div>
      ) : isComposerOpen ? (
        <form onSubmit={handleSendSubmit} className="flex flex-col gap-2.5">
          <Textarea
            autoFocus
            rows={3}
            placeholder={`Say hello to ${provider.name} and describe what you need...`}
            value={messageText}
            onChange={(event) => setMessageText(event.target.value)}
            disabled={isSending}
          />
          <div className="flex gap-2.5">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              disabled={isSending}
              onClick={() => setIsComposerOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={isSending || !messageText.trim()}>
              {isSending ? (
                <>
                  <Spinner /> Sending…
                </>
              ) : (
                'Send'
              )}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-2.5">
          <Button type="button" className="w-full" disabled={isPending} onClick={handleOpenComposer}>
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

      {sendError ? (
        <p className="mt-3 text-xs font-medium text-[var(--color-danger)]">{sendError}</p>
      ) : contactError ? (
        <p className="mt-3 text-xs font-medium text-[var(--color-danger)]">{contactError}</p>
      ) : null}

      {showBackLink ? (
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

      <div className="mt-4 border-t border-[var(--color-border)] pt-4">
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