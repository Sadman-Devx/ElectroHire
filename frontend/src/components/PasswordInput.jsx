import { useState, forwardRef } from 'react'
import { Eye, EyeOff } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Same as Input, but with a show/hide toggle button — the schedule
 * explicitly asks for this on the Login page, and it's just as useful
 * on Signup, so it's shared.
 */
const PasswordInput = forwardRef(function PasswordInput(
  { className, invalid, ...props },
  ref
) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        invalid={invalid}
        ref={ref}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"
      >
        {visible ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  )
})

export { PasswordInput }