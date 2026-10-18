import { AlertCircle, MapPin, Sparkles } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

import { AnalysisCard } from './AnalysisCard'
import { ProviderResults } from './ProviderResults'

/** The customer's side of the conversation. */
function UserBubble({ problem, area }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[var(--color-primary)] px-4 py-2.5 text-white shadow-sm">
        <p className="whitespace-pre-wrap break-words text-[15px]">{problem}</p>
        {area ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-white/85">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {area}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function AssistantAvatar() {
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-secondary-tint)] text-[var(--color-secondary)]">
      <Sparkles className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}

/** The assistant's side: loading, error (with retry), or the full answer. */
function AssistantMessage({ turn, onRetry }) {
  const language = turn.result?.language || 'en'

  return (
    <div className="flex gap-2.5">
      <AssistantAvatar />
      <div className="min-w-0 flex-1" lang={turn.status === 'done' ? language : undefined}>
        {turn.status === 'loading' ? (
          <div
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-2 rounded-2xl rounded-bl-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]"
          >
            <Spinner />
            AI is thinking…
          </div>
        ) : null}

        {turn.status === 'error' ? (
          <div
            role="alert"
            className="flex flex-col items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-tint)] p-4"
          >
            <p className="flex items-start gap-2 text-sm font-medium text-[var(--color-danger)]">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              {turn.error}
            </p>
            <Button type="button" size="sm" variant="secondary" onClick={() => onRetry(turn.id)}>
              Try again
            </Button>
          </div>
        ) : null}

        {turn.status === 'done' && turn.result ? (
          <div className="flex flex-col gap-4">
            <AnalysisCard result={turn.result} />
            <ProviderResults providers={turn.result.providers} language={language} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export { UserBubble, AssistantMessage }
