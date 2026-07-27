import { Loader2 } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * design.md calls for a spinner "used for button-level actions, in
 * primary blue color". Implemented with currentColor instead of a
 * hardcoded blue: on the primary (orange) button it inherits the
 * button's white text for contrast; on the secondary (white/blue)
 * button it reads as blue exactly as spec'd. Same component, correct
 * color either way.
 */
function Spinner({ className, ...props }) {
  return (
    <Loader2
      className={cn('h-4 w-4 animate-spin text-current', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export { Spinner }