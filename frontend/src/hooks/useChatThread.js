import { useCallback, useEffect, useRef, useState } from 'react'

import { getMessageThread, sendMessage } from '@/services/chatService'

const POLL_INTERVAL_MS = 5000

/**
 * Loads the message thread for whichever conversation is open, and
 * exposes send() to post a new message.
 *
 * Day 8, Dev 1 hand-off note in the old chatMockService.js expected
 * this hook's signature to stay `useChatThread(otherUserId, ...)`
 * unchanged. That held for the mock (keyed by other_user_id), but the
 * real backend endpoint is keyed by *provider_id*
 * (/api/contacts/messages/{provider_id}/), and a provider replying
 * additionally needs `?with=<customer_user_id>` — see
 * chatService.js's header comment. Both of those are only knowable
 * from the conversation object itself (which already carries
 * `provider_id` and `other_user_id`) plus the signed-in user's role,
 * so this hook now takes the whole `conversation` + `viewerRole`
 * instead of a bare id. Nothing in components/chat/ had to change —
 * they still just receive `messages` and an `otherUserId` for the
 * "is this mine" comparison, exactly as before.
 *
 *   const { messages, isLoading, error, send, isSending, sendError } =
 *     useChatThread(selectedConversation, user?.role, { onThreadOpened, onMessageSent })
 */
export function useChatThread(conversation, viewerRole, { onThreadOpened, onMessageSent } = {}) {
  const providerId = conversation?.provider_id ?? null
  const otherUserId = conversation?.other_user_id ?? null
  // Only a provider replying needs '?with=' to say which customer's
  // thread this is (see MessageListCreateView._resolve_other_user on
  // the backend). A provider's own conversations are always with
  // customers in this app's MVP scope, so role alone decides —
  // otherUserId is exactly the customer's id in that case.
  const withUserId = viewerRole === 'provider' ? otherUserId : undefined

  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(null)

  // Prevents a slow request (foreground or background poll) from
  // overlapping with the next 5s tick and stacking up retries.
  const isFetchingRef = useRef(false)

  useEffect(() => {
    // No conversation selected yet, or its provider_id hasn't
    // resolved from the conversation list yet (e.g. page just loaded
    // with ?with= in the URL) — nothing to fetch. Deliberately no
    // setState call here: any state from a previously-open thread is
    // masked out below (`providerId ? messages : []`) instead of
    // being cleared imperatively.
    if (!providerId || !otherUserId) return undefined

    let isMounted = true

    async function loadThread({ silent = false } = {}) {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      if (!silent) {
        setIsLoading(true)
        setError(null)
      }
      try {
        const data = await getMessageThread({ providerId, withUserId })
        if (isMounted) {
          setMessages(data)
          if (!silent) onThreadOpened?.(otherUserId)
        }
      } catch (err) {
        // A silent background poll failing (brief network blip, etc)
        // shouldn't rip a working conversation view out from under
        // someone mid-read to show an error banner — only the
        // foreground load surfaces errors.
        if (isMounted && !silent) {
          setError(err.message || 'Could not load this conversation. Please try again.')
        }
      } finally {
        isFetchingRef.current = false
        if (isMounted && !silent) setIsLoading(false)
      }
    }

    loadThread()

    // Day 8, Dev 1: "Auto-Refresh বানাও (setInterval — 5 seconds)" —
    // keeps the open thread current with whatever the other party
    // sends while this window stays open, without a manual reload.
    // MessageThread.jsx only auto-scrolls for these silent updates
    // when the reader is already near the bottom, so polling doesn't
    // yank someone away from history they're scrolled up reading.
    const intervalId = window.setInterval(() => loadThread({ silent: true }), POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
    // onThreadOpened is stable across renders in practice (ChatsPage
    // passes useConversations().markThreadRead), and re-running this
    // effect only needs to react to the conversation actually changing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, otherUserId, withUserId])

  const send = useCallback(
    async (content) => {
      if (!providerId || !content.trim()) return
      setIsSending(true)
      setSendError(null)
      try {
        const created = await sendMessage({ providerId, withUserId, content })
        onMessageSent?.(otherUserId, created)

        // Re-fetch instead of optimistically constructing the new
        // message locally: the real POST response only returns
        // { id, content, created_at } (MessageCreateResponseSerializer)
        // — no sender_id — so there's nothing here to safely stamp an
        // "is this mine" flag onto without guessing. One extra round
        // trip always renders with the real sender_id instead.
        const refreshed = await getMessageThread({ providerId, withUserId })
        setMessages(refreshed)
      } catch (err) {
        setSendError(err.message || 'Could not send your message. Please try again.')
      } finally {
        setIsSending(false)
      }
    },
    [providerId, withUserId, otherUserId, onMessageSent]
  )

  return {
    messages: providerId ? messages : [],
    isLoading,
    error: providerId ? error : null,
    send,
    isSending,
    sendError,
  }
}

export default useChatThread