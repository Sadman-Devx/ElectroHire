import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Flag, MoreVertical, User as UserIcon } from 'lucide-react'

function ReportMenu({ providerId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isAcknowledged, setIsAcknowledged] = useState(false)
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
          {providerId ? (
            <Link
              role="menuitem"
              to={`/providers/${providerId}`}
              onClick={() => setIsOpen(false)}
              className="block rounded-[calc(var(--radius-input)-4px)] px-3 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]"
            >
              View profile
            </Link>
          ) : null}

          {isAcknowledged ? (
            <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
              Thanks for letting us know. Reporting isn&rsquo;t open yet, but this will be
              reviewed once it is.
            </p>
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setIsAcknowledged(true)}
              className="flex w-full items-center gap-2 rounded-[calc(var(--radius-input)-4px)] px-3 py-2 text-left text-sm font-medium text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
            >
              <Flag className="h-3.5 w-3.5" aria-hidden="true" />
              Report
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Day 7 spec: chat header for the right panel — identity + online
 * indicator, plus "Report Button (Chat Header-এ ৩-dot Menu)". Report
 * is a placeholder acknowledgement, same wording StickyContactCard
 * already uses — the real Report model/API don't exist until Day 8,
 * Dev 2.
 *
 * `onBack` is only passed (and only rendered) on mobile, where the
 * chat window replaces the conversation list instead of sitting next
 * to it — see ChatsPage.jsx.
 */
function ChatWindowHeader({ conversation, onBack }) {
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
        {conversation.provider_id ? (
          <Link
            to={`/providers/${conversation.provider_id}`}
            className="hidden text-xs font-medium text-[var(--color-secondary)] hover:underline sm:block"
          >
            View profile
          </Link>
        ) : null}
        <ReportMenu providerId={conversation.provider_id} />
      </div>
    </div>
  )
}

export { ChatWindowHeader }