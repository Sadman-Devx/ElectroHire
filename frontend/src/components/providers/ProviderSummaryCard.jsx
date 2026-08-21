import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'

/**
 * Day 8, Dev 3: "Provider Info Card" — the compact provider identity
 * strip shown at the top of both the Rating Submit Page and the
 * Report Provider Page (design mock: website_remaining_pages_2.html,
 * Rating Submit page). Deliberately much smaller than
 * ProviderProfileHeader (the full Day 6 detail-page header) — this is
 * just "who am I rating/reporting", not the full profile.
 *
 * Field names match GET /api/providers/{id}/ exactly, same as every
 * other provider-detail component in this app.
 */
function ProviderSummaryCard({ provider }) {
  const { name, area, categories = [], photo } = provider

  const subtitle = [categories.length > 0 ? categories.join(', ') : null, area]
    .filter(Boolean)
    .join(' · ')

  return (
    <Card className="flex items-center gap-4 p-4">
      <Avatar
        src={photo}
        alt={name}
        size="h-12 w-12"
        iconSize="h-6 w-6"
        className="ring-2 ring-[var(--color-primary-tint)]"
      />

      <div className="min-w-0">
        <p className="truncate text-base font-semibold text-[var(--color-text)]">{name}</p>
        {subtitle ? (
          <p className="truncate text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        ) : null}
      </div>
    </Card>
  )
}

export { ProviderSummaryCard }