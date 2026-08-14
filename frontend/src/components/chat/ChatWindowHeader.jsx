import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Flag, MoreVertical, User as UserIcon } from 'lucide-react'

/**
 * `reportProviderId` is only set by the caller when the *other party*
 * in this thread is a provider (conversation.other_user_role ===
 * 'provider') — see ChatWindowHeader below. `conversation.provider_id`
 * is always present (every thread is provider-scoped on the backend),
 * but when the signed-in user IS the provider replying to a customer,
 * that id is the provider's own id, not the customer's — so it must
 * not be used here, or "Report" would silently let a provider report
 * themselves. Reporting a *user* isn't built yet (Day 8, Dev 3 only
 * covers reporting a provider — see pages/ReportProviderPage.jsx),
 * so that case still shows the "not open yet" placeholder.
 */
function ReportMenu({ reportProviderId }) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  // Click-outside-to-close — same manual approach the rest of this
  // app uses for its toggles (no headless-menu library is installed;
  // see DashboardNavbar's mobile menu button for the same pattern).
  useEffect(() => {
    if (!isOpen) return undefined

    function handlePointerDown(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="More options"
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-button)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]"
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-2 w-64 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg shadow-slate-200/70"
        >
          {reportProviderId ? (
            <Link
              role="menuitem"
              to={`/providers/${reportProviderId}`}
              onClick={() => setIsOpen(false)}
              className="block rounded-[calc(var(--radius-input)-4px)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            >
              View profile
            </Link>
          ) : null}

          {reportProviderId ? (
            <Link
              role="menuitem"
              to={`/providers/${reportProviderId}/report`}
              onClick={() => setIsOpen(false)}
              className="flex w-full items-center gap-2 rounded-[calc(var(--radius-input)-4px)] px-3 py-2 text-left text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              Report
            </Link>
          ) : (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              Reporting a user isn&rsquo;t available from chat yet.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Day 7 spec: chat header for the right panel — identity + online
 * indicator, plus "Report Button (Chat Header-এ ৩-dot Menu)". As of
 * Day 8, Dev 3, "Report" links to the real Report Provider Page
 * (route /providers/:id/report) whenever the other party is a
 * provider — it used to be a placeholder acknowledgement here because
 * the Report model/API didn't exist until Day 8, Dev 2.
 *
 * `onBack` is only passed (and only rendered) on mobile, where the
 * chat window replaces the conversation list instead of sitting next
 * to it — see ChatsPage.jsx.
 */
function ChatWindowHeader({ conversation, onBack }) {
  const reportProviderId =
    conversation.other_user_role === 'provider' ? conversation.provider_id : null
  return (
    <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-button)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}

        <div className="relative flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-bg)]">
            <UserIcon className="h-5 w-5 text-[var(--color-text-subtle)]" aria-hidden="true" />
          </div>
          {conversation.is_online ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-success)]"
              aria-label="Online"
            />
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--color-text)]">
            {conversation.other_user_name}
          </p>
          <p className="truncate text-xs text-[var(--color-text-subtle)]">
            {conversation.is_online ? 'Online' : 'Offline'}
            {conversation.other_user_role === 'provider' ? ' · Service provider' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {reportProviderId ? (
          <Link
            to={`/providers/${reportProviderId}`}
            className="hidden text-xs font-medium text-[var(--color-secondary)] hover:underline sm:block"
          >
            View profile
          </Link>
        ) : null}
        <ReportMenu reportProviderId={reportProviderId} />
      </div>
    </div>
  )
}

export { ChatWindowHeader }