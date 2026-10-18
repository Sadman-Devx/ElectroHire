import { Banknote, ShieldCheck, Wrench } from 'lucide-react'

import { Card } from '@/components/ui/card'
import { formatCostRange, textFor } from '@/lib/assistantText'

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
      </Card>
    </div>
  )
}

export { AnalysisCard }
