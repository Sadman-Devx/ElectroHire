import { Link } from 'react-router-dom'
import { SearchX } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { ProviderCard } from '@/components/providers/ProviderCard'
import { textFor } from '@/lib/assistantText'

function ProviderActions({ provider, language }) {
  const t = textFor(language)

  return (
    <div className="flex w-full flex-shrink-0 gap-2 sm:w-auto">
      <Button asChild size="sm" variant="secondary" className="flex-1 sm:flex-none">
        <Link to={`/providers/${provider.id}`} aria-label={`${t.contact} ${provider.name}`}>
          {t.contact}
        </Link>
      </Button>
      <Button asChild size="sm" className="flex-1 sm:flex-none">
        <Link to={`/providers/${provider.id}/book`} aria-label={`${t.book} ${provider.name}`}>
          {t.book}
        </Link>
      </Button>
    </div>
  )
}

/**
 * Renders the Phase 2 `providers` block: top matches with Contact /
 * Book, or a polite empty state with alternatives (other areas, other
 * categories). Provider objects are the same shape as
 * GET /api/providers/, so the existing ProviderCard is reused as-is.
 */
function ProviderResults({ providers, language = 'en' }) {
  if (!providers) return null

  const t = textFor(language)
  const matches = providers.matches || []
  const otherAreas = providers.alternatives?.other_areas || []
  const otherCategories = providers.alternatives?.other_categories || []

  if (matches.length > 0) {
    return (
      <section className="flex flex-col gap-3" aria-label={t.providersTitle}>
        <div>
          <h3 className="text-sm font-bold text-[var(--color-text)]">{t.providersTitle}</h3>
          {providers.message ? (
            <p className="text-xs text-[var(--color-text-muted)]">{providers.message}</p>
          ) : null}
        </div>
        {matches.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            actions={<ProviderActions provider={provider} language={language} />}
          />
        ))}
      </section>
    )
  }

  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
      aria-label={t.providersTitle}
    >
      <div className="flex items-start gap-3">
        <SearchX className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-text-subtle)]" aria-hidden="true" />
        <p className="text-sm text-[var(--color-text)]">{providers.message}</p>
      </div>

      {otherAreas.length > 0 ? (
        <div className="flex flex-col gap-3">
          <h4 className="text-sm font-bold text-[var(--color-text)]">{t.otherAreas}</h4>
          {otherAreas.map((provider) => (
            <ProviderCard key={provider.id} provider={provider} />
          ))}
        </div>
      ) : null}

      {otherCategories.length > 0 ? (
        <div>
          <h4 className="text-sm font-bold text-[var(--color-text)]">{t.otherCategories}</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {otherCategories.map((category) => (
              <Link
                key={category.id}
                to={`/providers?category=${category.id}`}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-text)] transition-colors hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-tint)]"
              >
                {category.name} ({category.provider_count})
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <Link
        to="/providers"
        className="text-sm font-semibold text-[var(--color-secondary)] hover:underline"
      >
        {t.browseAll}
      </Link>
    </section>
  )
}

export { ProviderResults }
