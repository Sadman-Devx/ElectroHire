import { User as UserIcon } from 'lucide-react'

import { formatConversationTime } from '@/lib/formatChatTime'
import { cn } from '@/lib/utils'

/**
 * Day 7 spec: conversation list row with "Unread Badge + Online
 * Indicator". The online dot reflects `conversation.is_online`, a
 * mock-only decorative field (see chatMockService.js) — there is no
 * real presence data yet, so this is a placeholder for the visual,
 * not a live status.
 */
function ConversationListItem({ conversation, isActive, onSelect }) {
  const hasUnread = conversation.unread_count > 0

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(conversation.other_user_id)}
        aria-current={isActive || undefined}
        className={cn(
          'flex w-full items-start gap-3 border-l-2 px-4 py-3 text-left transition-colors',
          isActive
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)]'
            : 'border-transparent hover:bg-[var(--color-bg)]'
        )}
      >
        <div className="relative flex-shrink-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-bg)]">
            <UserIcon className="h-5 w-5 text-[var(--color-text-subtle)]" aria-hidden="true" />
          </div>
          {conversation.is_online ? (
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-success)]"
              aria-label="Online"
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p
              className={cn(
                'truncate text-sm',
                hasUnread ? 'font-semibold text-[var(--color-text)]' : 'font-medium text-[var(--color-text)]'
              )}
            >
              {conversation.other_user_name}
            </p>
            <span className="flex-shrink-0 text-xs text-[var(--color-text-subtle)]">
              {formatConversationTime(conversation.last_message_at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <p
              className={cn(
                'truncate text-xs',
                hasUnread ? 'font-medium text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
              )}
            >
              {conversation.last_message || 'No messages yet'}
            </p>
            {hasUnread ? (
              <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] px-1.5 text-[11px] font-semibold text-white">
                {conversation.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  )
}

export { ConversationListItem }