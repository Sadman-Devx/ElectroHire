import { useSearchParams } from 'react-router-dom'

import { ChatWindow } from '@/components/chat/ChatWindow'
import { ConversationListPanel } from '@/components/chat/ConversationListPanel'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { Navbar } from '@/components/home/Navbar'
import { useAuth } from '@/context/useAuth'
import { useChatThread } from '@/hooks/useChatThread'
import { useConversations } from '@/hooks/useConversations'

/**
 * Day 7 — Dev 3: Chat Page (Web Version).
 *   → Left Panel: Conversation List
 *   → Search Box + Unread Badge + Online Indicator
 *   → Right Panel: Chat Window
 *   → Message Bubbles (Sent/Received, Timestamp)
 *   → Message Input + Send Button
 *   → 'Rate this provider' Prompt (Chat-এ Banner)
 *   → Report Button (Chat Header-এ ৩-dot Menu)
 * Output: Chat Page UI Ready.
 *
 * Route: /chats (protected — see App.jsx). Already forward-linked
 * from two places built on Day 6: DashboardNavbar's "Chats" nav item
 * and RecentMessagesPreview's "View all" link.
 *
 * DATA: backed by services/chatMockService.js today, not the real
 * Chat API — Dev 1's Day 7 task built that API, but wiring the
 * frontend to it is explicitly Day 8, Dev 1's task ("Chat API সব
 * React-এ Connect করো ... Auto-Refresh ... Auto-Scroll"). Every hook
 * and component below is already shaped around the real API's exact
 * response fields, so that wiring is a service-layer swap, not a
 * rewrite — see chatMockService.js's header comment for the hand-off
 * plan.
 *
 * The open conversation lives in the URL (`?with=<other_user_id>`)
 * rather than local state, so refreshing the page or sharing/bookmarking
 * a link keeps (or reopens) the right thread — same shareable-URL
 * instinct ProvidersPage already applies to its filters.
 *
 * Works for both roles (any authenticated user can have
 * conversations — ConversationListView on the backend doesn't
 * distinguish user vs provider), so there's no ProviderOnlyNotice
 * gate here, just ProtectedRoute. The navbar still adapts: providers
 * get DashboardNavbar (their "Chats" link highlights this page), a
 * regular user gets the public Navbar with its "Messages" link (Day 7
 * addition — see components/home/Navbar.jsx).
 */
function ChatsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const rawWith = searchParams.get('with')
  const parsedWith = rawWith ? Number(rawWith) : null
  const selectedOtherUserId = Number.isFinite(parsedWith) ? parsedWith : null

  const {
    conversations,
    visibleConversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    searchQuery,
    setSearchQuery,
    markThreadRead,
    applySentMessage,
  } = useConversations()

  const {
    messages,
    isLoading: isThreadLoading,
    error: threadError,
    send,
    isSending,
    sendError,
  } = useChatThread(selectedOtherUserId, {
    onThreadOpened: markThreadRead,
    onMessageSent: applySentMessage,
  })

  const selectedConversation =
    conversations.find((conversation) => conversation.other_user_id === selectedOtherUserId) ?? null

  function handleSelect(otherUserId) {
    setSearchParams(otherUserId ? { with: String(otherUserId) } : {})
  }

  function handleBack() {
    setSearchParams({})
  }

  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : Navbar

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--color-bg)]">
      <NavbarComponent />

      <main className="mx-auto flex w-full min-h-0 max-w-6xl flex-1 flex-col overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
        <h1 className="mb-4 flex-shrink-0 text-2xl font-bold text-[var(--color-text)]">Messages</h1>

        <div className="flex min-h-0 flex-1 overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm shadow-slate-200/60">
          <ConversationListPanel
            conversations={visibleConversations}
            totalCount={conversations.length}
            isLoading={isLoadingConversations}
            error={conversationsError}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            selectedOtherUserId={selectedOtherUserId}
            onSelect={handleSelect}
            className={selectedOtherUserId ? 'hidden lg:flex' : 'flex'}
          />

          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            isThreadLoading={isThreadLoading}
            threadError={threadError}
            onSend={send}
            isSending={isSending}
            sendError={sendError}
            onBack={handleBack}
            className={selectedOtherUserId ? 'flex' : 'hidden lg:flex'}
          />
        </div>
      </main>
    </div>
  )
}

export default ChatsPage