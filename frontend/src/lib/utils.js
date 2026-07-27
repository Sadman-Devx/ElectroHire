import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merges Tailwind classes safely (later classes win over earlier
 * conflicting ones). Standard shadcn/ui helper — every ui/ component
 * uses this instead of plain string concatenation.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}