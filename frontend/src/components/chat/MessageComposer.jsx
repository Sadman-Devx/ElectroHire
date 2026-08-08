import { useState } from 'react'
import { Send } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

/**
 * Day 7 spec: "Message Input + Send Button". Purely local UI today —
 * `onSend` is provided by ChatsPage via useChatThread(), which is
 * backed by the mock service until Day 8, Dev 1 swaps it for the real
 * POST /api/contacts/messages/{provider_id}/ call. Nothing here
 * changes when that happens.
 */
function MessageComposer({ onSend, isSending, isDisabled }) {
  const [draft, setDraft] = useState('')

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed || isSending) return
    onSend(trimmed)
    setDraft('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-shrink-0 items-center gap-2 border-t border-[var(--color-border)] p-3"
    >
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
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