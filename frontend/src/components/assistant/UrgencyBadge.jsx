import { cn } from '@/lib/utils'
import { textFor, urgencyStyle } from '@/lib/assistantText'

/** Pill showing the urgency level; emergency is solid red so it stands out. */
function UrgencyBadge({ urgency, language = 'en' }) {
  const style = urgencyStyle(urgency)
  const label = style.label[language] || style.label.en

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        style.className
      )}
    >
      <span className="font-medium opacity-80">{textFor(language).urgency}:</span>
      {label}
    </span>
  )
}

export { UrgencyBadge }
