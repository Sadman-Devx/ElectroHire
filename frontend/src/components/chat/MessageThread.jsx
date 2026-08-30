import { useEffect, useRef } from 'react'
import { AlertCircle, MessageCircle } from 'lucide-react'

import { formatMessageDayLabel } from '@/lib/formatChatTime'

import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

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

const NEAR_BOTTOM_THRESHOLD_PX = 150

/**
 * Day 7 spec: "Right Panel: Chat Window" message area. `isMine` for
 * each bubble is derived here from `otherUserId` — see
 * MessageBubble.jsx's comment for why that's the robust comparison
 * instead of needing to know the signed-in user's own id.
 */
function MessageThread({ messages, otherUserId, otherUserName, isLoading, error, isOtherTyping, onRetry }) {
  const containerRef = useRef(null)
  const bottomRef = useRef(null)
  const previousMessageCountRef = useRef(0)
  // Tracks scroll position from the reader's own last scroll action,
  // not from post-update layout — see the effect below for why that
  // distinction matters once auto-refresh polling is in play.
  const wasNearBottomRef = useRef(true)

  function handleScroll() {
    const container = containerRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    wasNearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX
  }

  useEffect(() => {
    const previousCount = previousMessageCountRef.current
    const isFirstRender = previousCount === 0
    const hasNewMessages = messages.length > previousCount
    previousMessageCountRef.current = messages.length

    if (!hasNewMessages) return

    // Day 8, Dev 1: "New Message আসলে Auto-Scroll করবে নিচে" — but
    // useChatThread.js now polls every 5s, so blindly scrolling on
    // every `messages` change would yank someone back to the bottom
    // while they're scrolled up reading history. Only jump down
    // automatically when: this is the thread's first render (nothing
    // to scroll away from yet), the reader was already near the
    // bottom, or the newest message is one they just sent themselves
    // (actively in the conversation, not reading back).
    //
    // wasNearBottomRef is read here rather than measuring
    // container.scrollHeight fresh: by the time this effect runs, the
    // DOM has already grown to include the new message(s), so a fresh
    // measurement would answer "is it near the bottom now" (always
    // true-ish right after growth) instead of "was the reader near
    // the bottom a moment ago" (the thing that actually matters).
    const newestMessage = messages[messages.length - 1]
    const newestIsMine = newestMessage && newestMessage.sender_id !== otherUserId

    if (isFirstRender || wasNearBottomRef.current || newestIsMine) {
      bottomRef.current?.scrollIntoView?.({ block: 'end' })
      wasNearBottomRef.current = true
    }
  }, [messages, otherUserId])

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
        {isOtherTyping ? (
          <div className="w-full px-4 pt-2">
            <TypingIndicator name={otherUserName} />
          </div>
        ) : null}
      </div>
    )
  }

  const groups = groupMessagesByDay(messages)

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      data-testid="message-thread-scroll-container"
      className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
    >
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
                  onRetry={onRetry}
                />
              ))}
            </div>
          </div>
        ))}
        {isOtherTyping ? <TypingIndicator name={otherUserName} /> : null}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

export { MessageThread }