import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Day 6 spec: "About Section". `description` is the provider's own
 * free text from POST /api/providers/profile/ (Day 4/5, provider
 * setup flow) — can legitimately be empty for a provider who skipped
 * it, so this has its own empty state rather than rendering nothing.
 */
function ProviderAbout({ description }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>About</CardTitle>
      </CardHeader>
      <CardContent>
        {description ? (
          <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--color-text-muted)]">
            {description}
          </p>
        ) : (
          <p className="text-sm text-[var(--color-text-subtle)]">
            This provider hasn&rsquo;t added a description yet.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export { ProviderAbout }