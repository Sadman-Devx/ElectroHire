import { MessagesSquare } from 'lucide-react'

/**
 * Placeholder for the right panel before any conversation is
 * selected. Visibility (desktop-only — mobile shows the conversation
 * list full-screen in this state instead) is decided by ChatWindow's
 * wrapper, not here, so there's exactly one place that owns the
 * mobile/desktop panel-switching rule.
 */
function ChatEmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <MessagesSquare className="h-10 w-10 text-[var(--color-text-subtle)]" aria-hidden="true" />
      <p className="text-sm font-semibold text-[var(--color-text)]">Select a conversation</p>
      <p className="max-w-[260px] text-sm text-[var(--color-text-muted)]">
        Pick someone from the list on the left to see your messages.
      </p>
    </div>
  )
}

export { ChatEmptyState }