import { Banknote, ExternalLink, ShieldCheck, Wrench } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatCostRange, safeSources, textFor } from '@/lib/assistantText'

import { EmergencyBanner } from './EmergencyBanner'
import { UrgencyBadge } from './UrgencyBadge'

/**
 * The AI's analysis: category, urgency, summary, safety tips, cost.
 *
 * Everything here is AI-generated text, so it is only ever rendered
 * as React text nodes (escaped) — never as HTML.
 */
function AnalysisCard({ result }) {
  const { category, category_fallback: categoryFallback, urgency, summary } = result
  const language = result.language || 'en'
  const t = textFor(language)
  const tips = result.safety_tips || []
  const cost = result.cost_estimate
  const sources = safeSources(result.sources)
  const isEmergency = urgency === 'emergency'
  const categoryKnown = category && !categoryFallback

  return (
    <div className="flex flex-col gap-3">
      {isEmergency ? <EmergencyBanner language={language} /> : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-tint)] px-2.5 py-0.5 text-xs font-semibold text-[var(--color-primary-hover)]">
            <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
            {categoryKnown ? category.name : t.categoryUnclear}
          </span>
          <UrgencyBadge urgency={urgency} language={language} />
        </div>

        <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text)]">{summary}</p>

        {tips.length > 0 ? (
          <div className="mt-4">
            <h3 className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-text)]">
              <ShieldCheck className="h-4 w-4 text-[var(--color-success)]" aria-hidden="true" />
              {t.safetyTips}
            </h3>
            <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-5 text-sm text-[var(--color-text)]">
              {tips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ol>
          </div>
        ) : null}

        {cost ? (
          <div className="mt-4 rounded-[var(--radius-input)] bg-[var(--color-bg)] p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Banknote className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {t.costTitle}
              </span>
              <span className="text-base font-bold text-[var(--color-text)]">
                {formatCostRange(cost)}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">{t.costNote}</p>
            {cost.disclaimer ? (
              <p className="mt-0.5 text-xs text-[var(--color-text-subtle)]">{cost.disclaimer}</p>
            ) : null}
          </div>
        ) : null}

        {sources.length > 0 ? (
          <div className="mt-4 border-t border-[var(--color-border)] pt-3">
            <h3 className="text-sm font-bold text-[var(--color-text)]">{t.sources}</h3>
            <p className="text-xs text-[var(--color-text-subtle)]">{t.sourcesNote}</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-start gap-1.5 text-sm text-[var(--color-secondary)] hover:underline"
                  >
                    <ExternalLink className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                    <span className="min-w-0 break-words">
                      {source.title}
                      {source.domain ? (
                        <span className="text-[var(--color-text-subtle)]"> · {source.domain}</span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p
          data-testid="assistant-disclaimer"
          className="mt-4 text-xs italic text-[var(--color-text-subtle)]"
        >
          {t.disclaimer}
        </p>
      </Card>
    </div>
  )
}

export { AnalysisCard }
