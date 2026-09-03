import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

// How long to wait after the last keystroke before telling the other
// party "stopped typing" — long enough to survive normal pauses
// between words, short enough that the indicator doesn't linger after
// someone's actually walked away from the keyboard.
const TYPING_STOP_DELAY_MS = 1500

/**
 * Day 7 spec: "Message Input + Send Button", extended with a live
 * typing signal (real-time chat pass): `onTypingChange(isTyping)` — if
 * provided — fires `true` on the first keystroke of a fresh draft and
 * `false` either on submit or after a pause with no further typing.
 * Deliberately not fired on every keystroke: that would flood the
 * WebSocket with one "typing" frame per character for no UI benefit,
 * since the other party's indicator is just a boolean.
 */
function MessageComposer({ onSend, isSending, isDisabled, onTypingChange }) {
  const [draft, setDraft] = useState('')
  const isTypingRef = useRef(false)
  const stopTypingTimerRef = useRef(null)

  function clearStopTypingTimer() {
    if (stopTypingTimerRef.current) {
      window.clearTimeout(stopTypingTimerRef.current)
      stopTypingTimerRef.current = null
    }
  }

  function handleChange(event) {
    const value = event.target.value
    setDraft(value)

    if (!onTypingChange) return

    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true
        onTypingChange(true)
      }
      clearStopTypingTimer()
      stopTypingTimerRef.current = window.setTimeout(() => {
        isTypingRef.current = false
        onTypingChange(false)
      }, TYPING_STOP_DELAY_MS)
    } else if (isTypingRef.current) {
      // Cleared the input entirely (select-all + delete, etc) — no
      // need to wait out the timer to say "stopped typing".
      clearStopTypingTimer()
      isTypingRef.current = false
      onTypingChange(false)
    }
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || isSending) return
    clearStopTypingTimer()
    isTypingRef.current = false
    // useChatThread's send() already signals "stopped typing" itself
    // (see its notifyTyping(false) call) — not duplicated here, this
    // just stops this component's own local timer from firing later.
    onSend(trimmed)
    setDraft('')
  }

  useEffect(() => clearStopTypingTimer, [])

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-shrink-0 items-center gap-2 border-t border-[var(--color-border)] p-3"
    >
      <Input
        value={draft}
        onChange={handleChange}
        placeholder="Type a message…"
        aria-label="Type a message"
        disabled={isDisabled}
        className="flex-1"
      />
      <Button type="submit" disabled={isDisabled || isSending || !draft.trim()} className="flex-shrink-0">
        {isSending ? (
          <>
            <Spinner /> Sending
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" /> Send
          </>
        )}
      </Button>
    </form>
  )
}

export { MessageComposer }