import { useCallback, useState } from 'react'

import { sendMessage } from '@/services/chatService'

/**
 * Sends the very first message to a provider from the Provider Detail
 * page's "Send Message" composer — see StickyContactCard.jsx.
 *
 * Reuses the exact same chatService.sendMessage() the Chat Page itself
 * calls (Day 8, Dev 1): a customer never needs '?with=' (see that
 * file's header comment — only a provider replying does), and the
 * backend already auto-creates the ContactLog as a side effect of the
 * first message (MessageListCreateView.post(), a get_or_create — see
 * contacts/views.py), so there's no separate POST /api/contacts/ call
 * needed for this "message" intent anymore. ("Show Number" still uses
 * that endpoint directly via useContactProvider — unrelated, no
 * message content involved there.)
 *
 *   const { send, isSending, error, reset } = useSendFirstMessage(provider.id)
 *   const created = await send('Ki obosthay AC ta thik korte parben?')
 */
export function useSendFirstMessage(providerId) {
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)

  const send = useCallback(
    async (content) => {
      setIsSending(true)
      setError(null)
      try {
        return await sendMessage({ providerId, content })
      } catch (err) {
        // A 404 here means "not built yet", not "this provider doesn't
        // want messages" — same distinction useContactProvider already
        // draws for the sibling Contact API.
        setError(
          err.status === 404
            ? "Messaging isn't available yet — please check back soon."
            : err.message || 'Could not send your message. Please try again.'
        )
        return null
      } finally {
        setIsSending(false)
      }
    },
    [providerId]
  )

  const reset = useCallback(() => setError(null), [])

  return { send, isSending, error, reset }
}

export default useSendFirstMessage