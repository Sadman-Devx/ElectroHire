import * as React from 'react'

import { cn } from '@/lib/utils'

const Input = React.forwardRef(function Input(
  { className, type = 'text', invalid = false, ...props },
  ref
) {
  return (
    <input
      type={type}
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        'flex h-11 w-full rounded-[var(--radius-input)] border bg-[var(--color-surface)] px-3.5 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] transition-colors',
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

export { Input }