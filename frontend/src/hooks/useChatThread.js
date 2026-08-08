import { useCallback, useEffect, useState } from 'react'

import { getMessageThread, sendMessage } from '@/services/chatMockService'

/**
 * Loads the message thread for whichever conversation is open, and
 * exposes send() to post a new message — same
 * loading/error/pending-mutation shape useContactProvider() already
 * uses for POST /api/contacts/.
 *
 * `otherUserId` may be null (no conversation selected yet); the
 * effect below no-ops instead of fetching in that case.
 *
 *   const { messages, isLoading, error, send, isSending, sendError } =
 *     useChatThread(selectedOtherUserId, { onThreadOpened, onMessageSent })
 */
export function useChatThread(otherUserId, { onThreadOpened, onMessageSent } = {}) {
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(null)

  useEffect(() => {
    // No conversation selected yet — nothing to fetch. Deliberately no
    // setState call here: any state from a previously-open thread is
    // masked out below (`otherUserId ? messages : []`) instead of
    // being cleared imperatively, so this effect body never calls
    // setState outside the async loadThread() it kicks off.
    if (!otherUserId) return undefined

    let isMounted = true

    async function loadThread() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await getMessageThread(otherUserId)
        if (isMounted) {
          setMessages(data)
          onThreadOpened?.(otherUserId)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Could not load this conversation. Please try again.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadThread()

    return () => {
      isMounted = false
    }
    // onThreadOpened is stable across renders in practice (ChatsPage
    // passes useConversations().markThreadRead), and re-running this
    // effect only needs to react to the conversation actually changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId])

  const send = useCallback(
    async (content) => {
      if (!otherUserId || !content.trim()) return
      setIsSending(true)
      setSendError(null)
      try {
        const created = await sendMessage({ otherUserId, content })
        onMessageSent?.(otherUserId, created)

        // Re-fetch instead of optimistically constructing the new
        // message locally: the real POST response only returns
        // { id, content, created_at } (MessageCreateResponseSerializer)
        // — no sender_id — so there's nothing here to safely stamp an
        // "is this mine" flag onto without guessing. One extra mock
        // round trip always renders with the real sender_id instead.
        const refreshed = await getMessageThread(otherUserId)
        setMessages(refreshed)
      } catch (err) {
        setSendError(err.message || 'Could not send your message. Please try again.')
      } finally {
        setIsSending(false)
      }
    },
    [otherUserId, onMessageSent]
  )

  return {
    messages: otherUserId ? messages : [],
    isLoading,
    error: otherUserId ? error : null,
    send,
    isSending,
    sendError,
  }
}

export default useChatThread