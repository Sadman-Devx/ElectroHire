import { Siren } from 'lucide-react'

import { textFor } from '@/lib/assistantText'

/** Stand-out warning shown above an emergency analysis. */
function EmergencyBanner({ language = 'en' }) {
  const t = textFor(language)

  return (
    <div
      role="alert"
      className="flex gap-3 rounded-[var(--radius-card)] border border-red-300 bg-red-50 p-4 text-red-800"
    >
      <Siren className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
      <div>
        <p className="text-sm font-bold">{t.emergencyTitle}</p>
        <p className="mt-1 text-sm">{t.emergencyBody}</p>
      </div>
    </div>
  )
}

export { EmergencyBanner }
