import { useSearchParams } from 'react-router-dom'

import { ChatWindow } from '@/components/chat/ChatWindow'
import { ConversationListPanel } from '@/components/chat/ConversationListPanel'
import { DashboardNavbar } from '@/components/dashboard/DashboardNavbar'
import { UserNavbar } from '@/components/dashboard/UserNavbar'
import { useAuth } from '@/context/useAuth'
import { useChatThread } from '@/hooks/useChatThread'
import { useConversations } from '@/hooks/useConversations'

/**
 * Day 7, Dev 3 (UI) + Day 8, Dev 1 (real data): Chat Page (Web Version).
 *   → Left Panel: Conversation List
 *   → Search Box + Unread Badge + Online Indicator
 *   → Right Panel: Chat Window
 *   → Message Bubbles (Sent/Received, Timestamp)
 *   → Message Input + Send Button
 *   → 'Rate this provider' Prompt (Chat-এ Banner)
 *   → Report Button (Chat Header-এ ৩-dot Menu)
 *   → Auto-Refresh (5s poll, both panels — see useConversations/useChatThread)
 *   → Auto-Scroll to newest message (see MessageThread.jsx)
 * Output: Chat API Fully Connected.
 *
 * Route: /chats (protected — see App.jsx). Already forward-linked
 * from two places built on Day 6: DashboardNavbar's "Chats" nav item
 * and RecentMessagesPreview's "View all" link.
 *
 * DATA: backed by services/chatService.js — the real
 * GET /api/contacts/conversations/ and GET/POST
 * /api/contacts/messages/{provider_id}/ endpoints Dev 1 built Day 7.
 * useConversations() polls every 5s; useChatThread() is now real-time
 * via WebSocket (see useChatThread.js), with a 20s poll only as a
 * fallback safety net.
 *
 * useChatThread() takes the whole `selectedConversation` (not just
 * its id) plus `user?.role`, because the real endpoint needs
 * `provider_id` (only available once the conversation list resolves
 * it) and a provider replying needs `?with=<customer_user_id>` too —
 * see useChatThread.js's header comment for why that's a deliberate
 * deviation from the Day 7 hand-off note's "hooks won't need to
 * change" expectation.
 *
 * ChatWindow is keyed by `selectedOtherUserId` so switching threads
 * remounts it — MessageComposer's draft text and RateProviderBanner's
 * dismissed flag reset per conversation instead of leaking into the
 * next one. (The component's own doc comment already assumed this
 * key existed; it didn't — added here as part of the Day 8 pre-build
 * audit, same category as the other pre-existing-bug fixes.)
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
 * regular user gets UserNavbar with its "Messages" link (Day 9,
 * Dev 1/3 post-launch fix — previously the public Navbar; see
 * UserNavbar.jsx's docstring for why that reuse was an actual
 * dead-link bug, not just a style mismatch).
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

  const selectedConversation =
    conversations.find((conversation) => conversation.other_user_id === selectedOtherUserId) ?? null

  const {
    messages,
    isLoading: isThreadLoading,
    error: threadError,
    send,
    isSending,
    sendError,
    connectionStatus,
    isOtherTyping,
    notifyTyping,
    retryFailedMessage,
  } = useChatThread(selectedConversation, user?.role, {
    onThreadOpened: markThreadRead,
    onMessageSent: applySentMessage,
  })

  function handleSelect(otherUserId) {
    setSearchParams(otherUserId ? { with: String(otherUserId) } : {})
  }

  function handleBack() {
    setSearchParams({})
  }

  const NavbarComponent = user?.role === 'provider' ? DashboardNavbar : UserNavbar

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
            key={selectedOtherUserId ?? 'none'}
            conversation={selectedConversation}
            messages={messages}
            isThreadLoading={isThreadLoading}
            threadError={threadError}
            onSend={send}
            isSending={isSending}
            sendError={sendError}
            connectionStatus={connectionStatus}
            isOtherTyping={isOtherTyping}
            onTypingChange={notifyTyping}
            onRetryMessage={retryFailedMessage}
            onBack={handleBack}
            className={selectedOtherUserId ? 'flex' : 'hidden lg:flex'}
          />
        </div>
      </main>
    </div>
  )
}

export default ChatsPage