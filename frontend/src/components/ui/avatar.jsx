import { useState } from 'react'
import { User as UserIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Shared circular avatar. Renders `src` when present, and — this is
 * the actual point of this component — automatically falls back to a
 * plain person icon if that URL fails to load, instead of leaving the
 * browser's native "broken image" glyph on screen.
 *
 * Four call sites (ProviderCard, ProviderProfileHeader,
 * ProviderSummaryCard, ContactHistorySection) each hand-rolled the
 * same `photo ? <img> : <UserIcon>` ternary with no `onError` handler.
 * That's fine as long as every photo URL always resolves, but a real
 * provider photo can 404 for perfectly ordinary reasons (file deleted
 * after upload, media misconfigured in an environment, a signed URL
 * that expired) — and none of those four call sites degraded
 * gracefully when that happened. Centralizing the fallback here means
 * every current and future avatar gets it for free, instead of
 * needing the same fix copy-pasted four more times.
 *
 * `hasError` resets whenever `src` changes to a new value — e.g.
 * scrolling a list — so it doesn't stay stuck showing the fallback
 * icon left over from a previous, broken photo. Adjusted directly
 * during render (React's documented pattern for "reset state when a
 * prop changes") rather than in a useEffect, so the reset lands in
 * the very first commit instead of a follow-up render.
 */
function Avatar({ src, alt, size = 'h-10 w-10', iconSize = 'h-4 w-4', className }) {
  const [hasError, setHasError] = useState(false)
  const [lastSrc, setLastSrc] = useState(src)

  if (src !== lastSrc) {
    setLastSrc(src)
    setHasError(false)
  }

  const showImage = Boolean(src) && !hasError

  return (
    <div
      className={cn(
        'flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-bg)]',
        size,
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <UserIcon className={cn('text-[var(--color-text-subtle)]', iconSize)} aria-hidden="true" />
      )}
    </div>
  )
}

export { Avatar }