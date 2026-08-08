import { useEffect, useMemo, useState } from 'react'

import { listConversations } from '@/services/chatMockService'

/**
 * Fetches the conversation list once on mount (same
 * loading/error/data shape useProviderDashboard() and
 * useProviderDetail() already use), plus client-side search filtering
 * for the Chat Page's "Search Box" requirement.
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

  useEffect(() => {
    let isMounted = true

    async function loadConversations() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await listConversations()
        if (isMounted) setConversations(data)
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Could not load your conversations. Please try again.')
        }
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    loadConversations()

    return () => {
      isMounted = false
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
  // clear immediately instead of waiting for a full refetch.
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
  // (last message + timestamp) updates without a full refetch.
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