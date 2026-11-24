import { ShieldCheck } from 'lucide-react'

/**
 * One calm line above the message box explaining why phone numbers
 * disappear from chat — so a masked message reads as a protection, not
 * a bug. Rating, reviews and reporting only exist for deals that stay
 * on ElectroHire, which is the honest reason to keep them here.
 *
 * Backend counterpart: contacts/masking.py hides numbers / e-mails /
 * messenger links before a message is saved.
 */
function ChatSafetyNotice() {
  return (
    <p className="flex flex-shrink-0 items-start gap-2 border-t border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-xs text-[var(--color-text-muted)]">
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--color-success)]" aria-hidden="true" />
      <span>
        Phone numbers, e-mails and social links are hidden in chat. Keep your booking on ElectroHire so
        ratings, reviews and reporting protect you both.
      </span>
    </p>
  )
}

export { ChatSafetyNotice }
export default ChatSafetyNotice