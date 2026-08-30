import { cn } from '@/lib/utils'

import { ChatEmptyState } from './ChatEmptyState'
import { ChatWindowHeader } from './ChatWindowHeader'
import { MessageComposer } from './MessageComposer'
import { MessageThread } from './MessageThread'
import { RateProviderBanner } from './RateProviderBanner'

/**
 * Day 7 spec: "Right Panel: Chat Window" — header, "Rate this
 * provider" banner, message bubbles, and the input/send row.
 *
 * Keyed by `conversation.other_user_id` at the call site (ChatsPage)
 * so every bit of local UI state living inside this subtree —
 * MessageComposer's draft text, RateProviderBanner's dismissed flag —
 * resets cleanly when the person switches threads, instead of a
 * half-typed reply or a dismissed banner leaking into the next chat.
 *
 * Real-time chat pass: `connectionStatus`, `isOtherTyping`,
 * `onTypingChange`, and `onRetryMessage` are threaded straight through
 * to ChatWindowHeader / MessageThread / MessageComposer from
 * useChatThread() (see ChatsPage.jsx) — this component stays a pure
 * layout/wiring shell, no socket logic of its own.
 */
function ChatWindow({
  conversation,
  messages,
  isThreadLoading,
  threadError,
  onSend,
  isSending,
  sendError,
  connectionStatus,
  isOtherTyping,
  onTypingChange,
  onRetryMessage,
  onBack,
  className,
}) {
  if (!conversation) {
    return (
      <div className={cn('min-h-0 flex-1 flex-col', className)}>
        <ChatEmptyState />
      </div>
    )
  }

  return (
    <div className={cn('min-h-0 flex-1 flex-col', className)}>
      <ChatWindowHeader conversation={conversation} connectionStatus={connectionStatus} onBack={onBack} />

      {conversation.other_user_role === 'provider' ? (
        <RateProviderBanner
          providerId={conversation.provider_id}
          providerName={conversation.other_user_name}
        />
      ) : null}

      <MessageThread
        messages={messages}
        otherUserId={conversation.other_user_id}
        otherUserName={conversation.other_user_name}
        isLoading={isThreadLoading}
        error={threadError}
        isOtherTyping={isOtherTyping}
        onRetry={onRetryMessage}
      />

      {sendError ? (
        <p role="alert" className="flex-shrink-0 px-4 pb-1 text-xs font-medium text-[var(--color-danger)]">
          {sendError}
        </p>
      ) : null}

      <MessageComposer
        onSend={onSend}
        isSending={isSending}
        isDisabled={isThreadLoading}
        onTypingChange={onTypingChange}
      />
    </div>
  )
}

export { ChatWindow }