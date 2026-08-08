import { AlertCircle, Inbox, Search, SearchX } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

import { ConversationListItem } from './ConversationListItem'

function ConversationSkeletonRow() {
  return (
    <div className="flex animate-pulse items-start gap-3 px-4 py-3">
      <div className="h-11 w-11 flex-shrink-0 rounded-full bg-[var(--color-bg)]" />
      <div className="flex-1">
        <div className="h-3.5 w-28 rounded bg-[var(--color-bg)]" />
        <div className="mt-2 h-3 w-40 rounded bg-[var(--color-bg)]" />
      </div>
    </div>
  )
}

/**
 * Day 7 spec: "Left Panel: Conversation List" + "Search Box + Unread
 * Badge + Online Indicator". The badge/dot live on ConversationListItem;
 * this component owns the search box and the list's four states
 * (loading, error, empty inbox, no search matches).
 *
 * Hidden below the `lg` breakpoint once a conversation is open — see
 * ChatsPage.jsx — so mobile shows one panel at a time.
 */
function ConversationListPanel({
  conversations,
  totalCount,
  isLoading,
  error,
  searchQuery,
  onSearchChange,
  selectedOtherUserId,
  onSelect,
  className,
}) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-col border-[var(--color-border)] lg:w-[320px] lg:flex-shrink-0 lg:border-r',
        className
      )}
    >
      <div className="flex-shrink-0 border-b border-[var(--color-border)] p-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search conversations…"
            aria-label="Search conversations"
            className="h-10 pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div>
            <ConversationSkeletonRow />
            <ConversationSkeletonRow />
            <ConversationSkeletonRow />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <AlertCircle className="h-6 w-6 text-[var(--color-danger)]" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--color-danger)]">{error}</p>
          </div>
        ) : totalCount === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <Inbox className="h-7 w-7 text-[var(--color-text-subtle)]" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--color-text)]">No conversations yet</p>
            <p className="max-w-[220px] text-xs text-[var(--color-text-muted)]">
              Message a provider from their profile page to start a conversation.
            </p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
            <SearchX className="h-7 w-7 text-[var(--color-text-subtle)]" aria-hidden="true" />
            <p className="text-sm font-medium text-[var(--color-text)]">No matches</p>
            <p className="max-w-[220px] text-xs text-[var(--color-text-muted)]">
              No conversations match &ldquo;{searchQuery}&rdquo;.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--color-border)]">
            {conversations.map((conversation) => (
              <ConversationListItem
                key={conversation.other_user_id}
                conversation={conversation}
                isActive={conversation.other_user_id === selectedOtherUserId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export { ConversationListPanel }