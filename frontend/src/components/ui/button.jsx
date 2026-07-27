import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-button)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        // Primary — design.md: "soft/light blue-orange tone" bg, white text, medium shadow
        primary:
          'bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-md shadow-orange-500/20 hover:bg-[var(--color-primary-hover)] focus-visible:ring-[var(--color-primary)]',
        // Secondary — design.md: white bg, blue border, blue text
        secondary:
          'bg-[var(--color-surface)] text-[var(--color-secondary)] border border-[var(--color-secondary)] hover:bg-[var(--color-secondary-tint)] focus-visible:ring-[var(--color-secondary)]',
        ghost:
          'bg-transparent text-[var(--color-text-muted)] hover:bg-slate-100 hover:text-[var(--color-text)]',
      },
      size: {
        default: 'h-11 px-5',
        sm: 'h-9 px-3.5 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
)

function Button({ className, variant, size, asChild = false, ...props }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export { Button, buttonVariants }