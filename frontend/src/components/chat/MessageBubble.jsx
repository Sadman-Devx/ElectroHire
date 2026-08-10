import { Check, CheckCheck } from 'lucide-react'

import { formatMessageTime } from '@/lib/formatChatTime'
import { cn } from '@/lib/utils'

/**
 * Day 7 spec: "Message Bubbles (Sent/Received, Timestamp)".
 *
 * `isMine` is passed in rather than computed here — MessageThread
 * derives it by comparing `message.sender_id !== otherUserId`, which
 * works identically against the real API's MessageListItemSerializer
 * shape (id, sender_id, sender_name, content, created_at, is_read),
 * with no dependency on knowing "my own" user id — useful since
 * AuthContext only stores { role, name } today (see
 * services/tokenStorage.js), not a user id.
 */
function MessageBubble({ message, isMine }) {
  return (
    <div className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-[var(--radius-input)] px-3.5 py-2.5 sm:max-w-[65%]',
          isMine
            ? 'rounded-br-sm bg-[var(--color-primary)] text-white'
            : 'rounded-bl-sm bg-[var(--color-bg)] text-[var(--color-text)]'
        )}
      >
        <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1 text-[11px]',
            isMine ? 'text-white/80' : 'text-[var(--color-text-subtle)]'
          )}
        >
          <span>{formatMessageTime(message.created_at)}</span>
          {isMine ? (
            message.is_read ? (
              <CheckCheck className="h-3.5 w-3.5" aria-label="Read" />
            ) : (
              <Check className="h-3.5 w-3.5" aria-label="Sent" />
            )
          ) : null}
        </div>
      </div>
    </div>
  )
}

export { MessageBubble }