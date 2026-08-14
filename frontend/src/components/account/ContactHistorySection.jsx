import { Link } from 'react-router-dom'
import { AlertCircle, MapPin, Phone, User as UserIcon } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatConversationTime } from '@/lib/formatChatTime'

function ContactItemSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 py-3">
      <div className="h-9 w-9 flex-shrink-0 rounded-full bg-[var(--color-bg)]" />
      <div className="flex-1">
        <div className="h-3.5 w-28 rounded bg-[var(--color-bg)]" />
        <div className="mt-2 h-3 w-20 rounded bg-[var(--color-bg)]" />
      </div>
    </div>
  )
}

/**
 * Day 9, Dev 1: "User Account Page" -> "Contact History" section.
 * Sourced from GET /api/contacts/history/ via useContactHistory()
 * (both new today — not in the API Contract PDF). Same
 * skeleton/empty/error shape as
 * components/dashboard/RecentMessagesPreview.jsx.
 */
function ContactHistorySection({ history, isLoading, error }) {
  return (
    <Card className="p-5 sm:p-6">
      <p className="mb-1 text-sm font-semibold text-[var(--color-text)]">Contact history</p>

      {isLoading ? (
        <div className="divide-y divide-[var(--color-border)]">
          <ContactItemSkeleton />
          <ContactItemSkeleton />
        </div>
      ) : error ? (
        <p className="flex items-center gap-2 py-6 text-sm font-medium text-[var(--color-danger)]">
          <AlertCircle className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <Phone className="h-7 w-7 text-[var(--color-text-subtle)]" aria-hidden="true" />
          <p className="text-sm text-[var(--color-text-muted)]">
            You haven&rsquo;t contacted any providers yet.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {history.map((item) => (
            <li key={item.provider_id} className="flex items-center gap-3 py-3">
              <Link
                to={`/providers/${item.provider_id}`}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-bg)]"
              >
                {item.provider_photo ? (
                  <img
                    src={item.provider_photo}
                    alt={item.provider_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-4 w-4 text-[var(--color-text-subtle)]" aria-hidden="true" />
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to={`/providers/${item.provider_id}`}
                  className="truncate text-sm font-medium text-[var(--color-text)] hover:underline"
                >
                  {item.provider_name}
                </Link>
                {item.provider_area ? (
                  <p className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <MapPin className="h-3 w-3" aria-hidden="true" /> {item.provider_area}
                  </p>
                ) : null}
              </div>
              <span className="flex-shrink-0 text-xs text-[var(--color-text-subtle)]">
                {formatConversationTime(item.contacted_at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export { ContactHistorySection }