import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { listConversations } from '@/services/chatService'

const POLL_INTERVAL_MS = 15000

/**
 * Total unread message count across every conversation, for a small
 * badge on the "Messages"/"Chats" nav link — so a new message is
 * noticeable from any page (dashboard, account, wherever), not only
 * once already inside ChatsPage. ChatsPage's own left panel already
 * shows a per-conversation unread badge (ConversationListItem.jsx,
 * same visual style reused here) — this is the same signal, just
 * visible one level up, in the navbar every authenticated page shares.
 *
 * Skips fetching (and reports 0, hiding the badge) while already on
 * /chats — ChatsPage renders this same navbar and already runs its
 * own useConversations() poll for the identical data; fetching it
 * again here would just be a second, redundant request to the same
 * endpoint, and the badge itself is meaningless on the one page
 * already showing exactly which conversations are unread.
 *
 * Deliberately its own lighter poll (15s, not ChatsPage's 5s /
 * useChatThread's WebSocket) on every other page: this one runs
 * continuously in the background regardless of which page someone is
 * on, so it stays courteous of that rather than matching the open
 * chat page's own faster cadence — a nav badge doesn't need
 * sub-5-second precision.
 *
 * Silently ignores fetch errors: a nav badge that briefly fails to
 * refresh isn't worth an error banner on every page in the app —
 * worst case it just under-counts until the next successful poll.
 *
 *   const unreadCount = useUnreadMessagesCount()
 */
export function useUnreadMessagesCount() {
  const { pathname } = useLocation()
  const isOnChatsPage = pathname.startsWith('/chats')

  const [unreadCount, setUnreadCount] = useState(0)

  // Prevents a slow request (foreground or background poll) from
  // overlapping with the next tick and stacking up retries — same
  // guard useConversations.js uses for the same reason.
  const isFetchingRef = useRef(false)

  useEffect(() => {
    if (isOnChatsPage) return undefined

    let isMounted = true

    async function load() {
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      try {
        const conversations = await listConversations()
        if (isMounted) {
          const total = conversations.reduce(
            (sum, conversation) => sum + (conversation.unread_count || 0),
            0
          )
          setUnreadCount(total)
        }
      } catch {
        // Silent on purpose — see doc comment above.
      } finally {
        isFetchingRef.current = false
      }
    }

    load()
    const intervalId = window.setInterval(load, POLL_INTERVAL_MS)

    return () => {
      isMounted = false
      isFetchingRef.current = false
      window.clearInterval(intervalId)
    }
  }, [isOnChatsPage])

  // Derived at return time, not written back via setState in the
  // effect above — an unconditional setUnreadCount(0) there would
  // fire an extra render on every navigation to/from /chats for no
  // benefit, since this achieves the same "hidden while on /chats"
  // result. The underlying state simply keeps its last fetched value
  // in the background, ready to resume the moment isOnChatsPage flips
  // back to false.
  return isOnChatsPage ? 0 : unreadCount
}

export default useUnreadMessagesCount