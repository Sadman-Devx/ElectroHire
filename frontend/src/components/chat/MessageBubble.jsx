import { Check, CheckCheck, Clock, RotateCcw } from 'lucide-react'

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
 * services/tokenStorage.js), not a user id. It's also what makes an
 * optimistic `sender_id: null` placeholder (useChatThread.js's send())
 * render on the right side immediately, before the real id exists.
 *
 * Real-time chat pass: a bubble can now be `_pending` (sent locally,
 * POST still in flight — clock icon) or `_failed` (POST rejected —
 * tap to retry via `onRetry`). Neither status exists once a message
 * has round-tripped through the server, so this only ever applies to
 * `isMine` bubbles.
 */
function MessageBubble({ message, isMine, onRetry }) {
  const isPending = isMine && message._pending
  const isFailed = isMine && message._failed

  return (
    <div className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'flex',
          isMine ? 'justify-end' : 'justify-start',
          isFailed && 'cursor-pointer'
        )}
        role={isFailed ? 'button' : undefined}
        tabIndex={isFailed ? 0 : undefined}
        onClick={isFailed ? () => onRetry?.(message) : undefined}
        onKeyDown={
          isFailed
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') onRetry?.(message)
              }
            : undefined
        }
      >
        <div
          className={cn(
            'max-w-[75%] rounded-[var(--radius-input)] px-3.5 py-2.5 sm:max-w-[65%]',
            isMine
              ? 'rounded-br-sm bg-[var(--color-primary)] text-white'
              : 'rounded-bl-sm bg-[var(--color-bg)] text-[var(--color-text)]',
            isPending && 'opacity-70',
            isFailed && 'bg-[var(--color-danger)] opacity-90'
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
              isFailed ? (
                <RotateCcw className="h-3.5 w-3.5" aria-label="Failed to send — tap to retry" />
              ) : isPending ? (
                <Clock className="h-3.5 w-3.5" aria-label="Sending" />
              ) : message.is_read ? (
                <CheckCheck className="h-3.5 w-3.5" aria-label="Read" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-label="Sent" />
              )
            ) : null}
          </div>
        </div>
      </div>
      {isFailed ? (
        <p className="mt-0.5 text-[11px] font-medium text-[var(--color-danger)]">
          Failed to send · Tap to retry
        </p>
      ) : null}
    </div>
  )
}

export { MessageBubble }