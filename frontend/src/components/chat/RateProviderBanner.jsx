import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Star, X } from 'lucide-react'

/**
 * Day 7 spec: "'Rate this provider' Prompt (Chat-এ Banner)". Only
 * shown when the other party is a provider — a provider chatting with
 * a plain "user" customer has no one to rate here.
 *
 * Links to /providers/:id/rate, same forward-linking pattern
 * DashboardNavbar already uses for "Reviews" -> /provider/reviews:
 * the real Rating Submit Page doesn't exist until Day 8, Dev 3, so
 * this 404s via App.jsx's catch-all route until then. Nothing here
 * needs to change once that page lands — just remove this comment.
 *
 * Dismissible per conversation: ChatWindow renders this keyed by
 * `conversation.other_user_id`, so the dismissal (and any other local
 * UI state in the chat window) resets automatically when the person
 * switches to a different thread instead of leaking across chats.
 */
function RateProviderBanner({ providerId, providerName }) {
  const [isDismissed, setIsDismissed] = useState(false)

  if (!providerId || isDismissed) return null

  return (
    <div className="mx-4 mt-3 flex flex-shrink-0 items-center justify-between gap-2 rounded-[var(--radius-input)] bg-[var(--color-primary-tint)] px-4 py-2.5">
      <Link
        to={`/providers/${providerId}/rate`}
        className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-[var(--color-primary-hover)]"
      >
        <Star className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span className="truncate">Rate {providerName}</span>
        <ChevronRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={() => setIsDismissed(true)}
        aria-label="Dismiss"
        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-primary-hover)]/70 hover:bg-white/50 hover:text-[var(--color-primary-hover)]"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  )
}

export { RateProviderBanner }