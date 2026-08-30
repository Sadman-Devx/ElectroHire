/**
 * Real-time chat pass: rendered inside MessageThread when the other
 * party is actively typing (see useChatThread's `isOtherTyping`,
 * driven by MessageComposer's onTypingChange -> the WebSocket ->
 * contacts/consumers.py's chat.typing group event). Styled like an
 * incoming bubble (left-aligned, same bg as a received message) so it
 * reads as "they're about to send something" rather than a system
 * notice.
 */
function TypingIndicator({ name }) {
  return (
    <div className="flex justify-start" aria-live="polite">
      <div className="flex items-center gap-1.5 rounded-[var(--radius-input)] rounded-bl-sm bg-[var(--color-bg)] px-3.5 py-2.5">
        <span className="sr-only">{name ? `${name} is typing…` : 'Typing…'}</span>
        <span className="flex gap-1" aria-hidden="true">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-subtle)] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-subtle)] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-subtle)]" />
        </span>
      </div>
    </div>
  )
}

export { TypingIndicator }