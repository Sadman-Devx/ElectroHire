import { useEffect, useRef } from 'react'
import { AlertCircle, MessageCircle } from 'lucide-react'

import { formatMessageDayLabel } from '@/lib/formatChatTime'

import { MessageBubble } from './MessageBubble'

function dayKeyOf(isoString) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return 'unknown'
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * Groups a flat message list into per-calendar-day sections so a
 * "Today" / "Yesterday" divider can sit above the first message of
 * each day — same idea as the provided chat mock's "Today" divider
 * (website_remaining_pages_2.html).
 */
function groupMessagesByDay(messages) {
  const groups = []
  let currentKey = null

  for (const message of messages) {
    const key = dayKeyOf(message.created_at)
    if (key !== currentKey) {
      groups.push({ key, label: formatMessageDayLabel(message.created_at), messages: [] })
      currentKey = key
    }
    groups[groups.length - 1].messages.push(message)
  }

  return groups
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4" aria-hidden="true">
      <div className="h-10 w-2/3 animate-pulse rounded-[var(--radius-input)] rounded-bl-sm bg-[var(--color-bg)]" />
      <div className="ml-auto h-10 w-1/2 animate-pulse rounded-[var(--radius-input)] rounded-br-sm bg-[var(--color-bg)]" />
      <div className="h-10 w-3/5 animate-pulse rounded-[var(--radius-input)] rounded-bl-sm bg-[var(--color-bg)]" />
    </div>
  )
}

/**
 * Day 7 spec: "Right Panel: Chat Window" message area. `isMine` for
 * each bubble is derived here from `otherUserId` — see
 * MessageBubble.jsx's comment for why that's the robust comparison
 * instead of needing to know the signed-in user's own id.
 */
function MessageThread({ messages, otherUserId, isLoading, error }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ block: 'end' })
  }, [messages])

  if (isLoading) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ThreadSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <AlertCircle className="h-7 w-7 text-[var(--color-danger)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <MessageCircle className="h-7 w-7 text-[var(--color-text-subtle)]" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text-muted)]">
          No messages yet — say hello to start the conversation.
        </p>
      </div>
    )
  }

  const groups = groupMessagesByDay(messages)

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="flex flex-col gap-4">
        {groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <p className="text-center text-xs font-medium text-[var(--color-text-subtle)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-2">
              {group.messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  isMine={message.sender_id !== otherUserId}
                />
              ))}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export { MessageThread }