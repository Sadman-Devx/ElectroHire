import { UserRound, Wrench, Check } from 'lucide-react'

import { cn } from '@/lib/utils'

const ROLES = [
  {
    value: 'user',
    icon: UserRound,
    title: 'I need a service',
    description: 'Find and hire trusted electricians, plumbers, tutors and more.',
  },
  {
    value: 'provider',
    icon: Wrench,
    title: 'I offer a service',
    description: 'List your skills and get hired by people near you.',
  },
]

/**
 * Signup's role picker. Two cards, one selected at a time — the
 * selected card gets a colored border + tinted background + a check
 * badge, per the schedule's "Role Select Card ... Highlighted Border".
 */
function RoleSelect({ value, onChange, error }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="I am signing up as">
        {ROLES.map(({ value: roleValue, icon: Icon, title, description }) => {
          const selected = value === roleValue
          return (
            <button
              key={roleValue}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(roleValue)}
              className={cn(
                'relative flex flex-col items-start gap-2 rounded-[var(--radius-card)] border-2 p-4 text-left transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
                selected
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)] shadow-sm'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)]'
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-primary)] text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
              ) : null}
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-full',
                  selected
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-slate-100 text-[var(--color-text-muted)]'
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="text-sm font-semibold text-[var(--color-text)]">{title}</span>
              <span className="text-xs leading-snug text-[var(--color-text-muted)]">
                {description}
              </span>
            </button>
          )
        })}
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">{error}</p>
      ) : null}
    </div>
  )
}

export { RoleSelect }