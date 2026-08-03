import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Same visual language as ui/input.jsx — added Day 5 for the
 * Provider Profile Setup page's "About you" field.
 */
const Textarea = React.forwardRef(function Textarea(
  { className, invalid = false, rows = 4, ...props },
  ref
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex w-full resize-none rounded-[var(--radius-input)] border bg-[var(--color-surface)] px-3.5 py-2.5 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-offset-1',
        invalid
          ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]'
          : 'border-[var(--color-border)] focus:ring-[var(--color-primary)] focus:border-[var(--color-primary)]',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
})

export { Textarea }