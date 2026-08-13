import { AlertTriangle, CircleHelp, Info, ShieldAlert, UserX } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Day 8 spec: "Predefined Reason List". Values kept in sync with
 * backend/reports/models.py's Report.REASON_CHOICES exactly (fake,
 * inappropriate, wrong_info, harassment, other) — a reason picked
 * here is sent to POST /api/reports/ as-is
 * (reports/serializers.py ReportCreateSerializer.reason is a
 * ChoiceField over that same set), so drifting from it would make a
 * valid-looking selection fail the request with a 400.
 */
const REPORT_REASONS = [
  {
    value: 'fake',
    label: 'Fake or misleading profile',
    description: 'This provider doesn\u2019t seem real, or is impersonating someone else.',
    icon: UserX,
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate content or behavior',
    description: 'Offensive photos, messages, or conduct.',
    icon: AlertTriangle,
  },
  {
    value: 'wrong_info',
    label: 'Wrong or outdated information',
    description: 'Categories, area, or experience don\u2019t match reality.',
    icon: Info,
  },
  {
    value: 'harassment',
    label: 'Harassment or abuse',
    description: 'Threatening, abusive, or unwanted contact.',
    icon: ShieldAlert,
  },
  {
    value: 'other',
    label: 'Something else',
    description: 'Doesn\u2019t fit the options above \u2014 explain in the details field.',
    icon: CircleHelp,
  },
]

/**
 *   const [reason, setReason] = useState('')
 *   <ReasonList selected={reason} onChange={setReason} />
 */
function ReasonList({ selected, onChange, disabled = false }) {
  return (
    <div role="radiogroup" aria-label="Reason for reporting" className="flex flex-col gap-2.5">
      {REPORT_REASONS.map(({ value, label, description, icon: Icon }) => {
        const isSelected = selected === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(value)}
            className={cn(
              'flex items-start gap-3 rounded-[var(--radius-input)] border p-3.5 text-left transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1',
              'disabled:cursor-not-allowed disabled:opacity-50',
              isSelected
                ? 'border-[var(--color-danger)] bg-[var(--color-danger-tint)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-5 w-5 flex-shrink-0',
                isSelected ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-subtle)]'
              )}
              aria-hidden="true"
            />
            <span className="min-w-0">
              <span
                className={cn(
                  'block text-sm font-semibold',
                  isSelected ? 'text-[var(--color-danger)]' : 'text-[var(--color-text)]'
                )}
              >
                {label}
              </span>
              <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">
                {description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

export { ReasonList, REPORT_REASONS }