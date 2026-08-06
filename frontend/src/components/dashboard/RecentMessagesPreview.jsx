import { Link } from 'react-router-dom'
import { MessageCircle, User as UserIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'

/**
 * Day 6 spec: "Recent Messages Preview Section". Links out to /chats
 * (Day 7, Dev 3's Chat Page — doesn't exist yet), same forward-linking
 * pattern ProviderCard already used on Day 5 pointing at the Day 6
 * detail page before it existed.
 */
function MessagePreviewSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 py-3">
      <div className="h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-bg)]" />
      <div className="flex-1">
        <div className="h-3.5 w-28 rounded bg-[var(--color-bg)]" />
        <div className="mt-2 h-3 w-44 rounded bg-[var(--color-bg)]" />
      </div>
    </div>
  )
}

function RecentMessagesPreview({ messages, isLoading, isAvailable }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-text)]">Recent messages</p>
        <Link
          to="/chats"
          className="text-xs font-medium text-[var(--color-secondary)] hover:underline"
        >
          View all
        </Link>
      </div>

      {isLoading ? (
        <div className="divide-y divide-[var(--color-border)]">
          <MessagePreviewSkeleton />
          <MessagePreviewSkeleton />
          <MessagePreviewSkeleton />
        </div>
      ) : !isAvailable ? (
        <p className="py-6 text-center text-sm text-[var(--color-text-subtle)]">
          Messages aren&rsquo;t available here yet — check back soon.
        </p>
      ) : !messages || messages.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <MessageCircle className="h-7 w-7 text-[var(--color-text-subtle)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-muted)]">No messages yet</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {messages.slice(0, 3).map((message) => (
            <li key={message.id} className="flex items-center gap-3 py-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-bg)]">
                <UserIcon className="h-4 w-4 text-[var(--color-text-subtle)]" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-text)]">
                  {message.sender_name}
                </p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">
                  {message.content}
                </p>
              </div>
              {!message.is_read ? (
                <span
                  className="h-2 w-2 flex-shrink-0 rounded-full bg-[var(--color-primary)]"
                  aria-label="Unread"
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export { RecentMessagesPreview }