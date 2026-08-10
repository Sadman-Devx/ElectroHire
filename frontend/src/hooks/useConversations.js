import { useEffect, useMemo, useRef, useState } from 'react'

import { listConversations } from '@/services/chatService'

const POLL_INTERVAL_MS = 5000

/**
 * Fetches the conversation list on mount, then keeps it fresh with a
 * silent 5s poll (Day 8, Dev 1: "Auto-Refresh বানাও (setInterval —
 * 5 seconds)" applies to the left panel too, not just an open thread
 * — a new conversation, or a new last-message/unread-count on an
 * existing one, should show up without a manual page reload). Plus
 * client-side search filtering for the Chat Page's "Search Box"
 * requirement.
 *
 * Returns both the full list and the search-filtered one: ChatsPage
 * needs the *full* list to resolve the currently-open conversation's
 * header info even while a search query hides it from the visible
 * list — filtering only affects what's rendered, never which
 * conversation is "selected".
 *
 *   const {
 *     conversations, visibleConversations, isLoading, error,
 *     searchQuery, setSearchQuery, markThreadRead, applySentMessage,
 *   } = useConversations()
 */
export function useConversations() {
  const [conversations, setConversations] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Prevents a slow request (foreground or background poll) from
  // overlapping with the next 5s tick and stacking up retries.
  const isFetchingRef = useRef(false)

  useEffect(() => {
    let isMounted = true

    async function loadConversations({ silent = false } = {}) {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      if (!silent) {
        setIsLoading(true)
        setError(null)
      }
      try {
        const data = await listConversations()
        if (isMounted) setConversations(data)
      } catch (err) {
        // A silent background poll failing (brief network blip, etc)
        // shouldn't replace a working inbox with an error banner —
        // only the foreground load surfaces errors.
        if (isMounted && !silent) {
          setError(err.message || 'Could not load your conversations. Please try again.')
        }
      } finally {
        isFetchingRef.current = false
        if (isMounted && !silent) setIsLoading(false)
      }
    }

    loadConversations()

    const intervalId = window.setInterval(() => loadConversations({ silent: true }), POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      window.clearInterval(intervalId)
    }
  }, [])

  const visibleConversations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return conversations
    return conversations.filter((conversation) =>
      conversation.other_user_name.toLowerCase().includes(query)
    )
  }, [conversations, searchQuery])

  // Called when a thread is opened — GET-ing a thread marks the other
  // party's messages read on the backend too (see
  // MessageListCreateView.get()), so the list's unread badge should
  // clear immediately instead of waiting for the next poll.
  function markThreadRead(otherUserId) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.other_user_id === otherUserId
          ? { ...conversation, unread_count: 0 }
          : conversation
      )
    )
  }

  // Called after a message send succeeds, so the list's preview
  // (last message + timestamp) updates without waiting for the next poll.
  function applySentMessage(otherUserId, { content, created_at }) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.other_user_id === otherUserId
          ? { ...conversation, last_message: content, last_message_at: created_at }
          : conversation
      )
    )
  }

  return {
    conversations,
    visibleConversations,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    markThreadRead,
    applySentMessage,
  }
}

export default useConversations