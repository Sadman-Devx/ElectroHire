import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { Spinner } from '@/components/ui/spinner'
import { useDeleteAccount } from '@/hooks/useDeleteAccount'
import { validateCurrentPassword } from '@/lib/validators'

/**
 * Day 11: Account Page danger zone — "Delete account", the frontend
 * side of DELETE /api/auth/account/ (users/views.py AccountDeleteView).
 *
 * Opens a confirmation Dialog (new this same day — see ui/dialog.jsx)
 * asking for the current password, same "prove you're really you"
 * re-confirmation the backend itself requires (see
 * AccountDeleteSerializer's docstring) rather than trusting a single
 * button click to mean it.
 *
 * On success, useDeleteAccount() already cleared the local session
 * (calls AuthContext's logout() internally) — this component's only
 * remaining job is to navigate the now-logged-out visitor to the
 * public home page, and to do it with `replace: true` so the browser
 * back button can't return them to the now-nonexistent /account.
 *
 * Deliberately its own component (not inlined into AccountPage.jsx)
 * so the dialog's open/submit/error state doesn't add three more
 * useState calls to an already-composed page, same "one section, one
 * concern" split AccountPage.jsx already uses for ProfileInfoCard/
 * MyRatingsSection/ContactHistorySection.
 */
function DeleteAccountSection() {
  const navigate = useNavigate()
  const { confirm, isSubmitting, error, reset } = useDeleteAccount()

  const [isOpen, setIsOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [submitAttempted, setSubmitAttempted] = useState(false)

  const passwordError = validateCurrentPassword(password)

  function openDialog() {
    setIsOpen(true)
  }

  function closeDialog() {
    if (isSubmitting) return
    setIsOpen(false)
    setPassword('')
    setSubmitAttempted(false)
    reset()
  }

  async function handleConfirm(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    if (passwordError) return

    const ok = await confirm({ password })
    if (ok) {
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="rounded-[var(--radius-input)] border border-[var(--color-danger)]/30 bg-[var(--color-danger-tint)] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-danger)]" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[var(--color-text)]">Delete account</p>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            This permanently deletes your ElectroHire account, profile, messages, ratings and
            bookings. This action cannot be undone.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-3 border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-tint)]"
            onClick={openDialog}
          >
            <Trash2 className="h-4 w-4" /> Delete my account
          </Button>
        </div>
      </div>

      <Dialog
        open={isOpen}
        onClose={closeDialog}
        title="Delete your account?"
        description="Enter your current password to confirm. This cannot be undone."
      >
        <form onSubmit={handleConfirm} noValidate className="flex flex-col gap-4">
          <FormField
            id="delete-account-password"
            label="Current password"
            error={submitAttempted ? passwordError : null}
          >
            <PasswordInput
              id="delete-account-password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              invalid={Boolean(submitAttempted && passwordError)}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) reset()
              }}
              autoFocus
            />
          </FormField>

          {error ? (
            <p role="alert" className="text-sm font-medium text-[var(--color-danger)]">
              {error}
            </p>
          ) : null}

          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={closeDialog}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-[2] bg-[var(--color-danger)] shadow-none hover:bg-red-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Spinner /> Deleting…
                </>
              ) : (
                'Delete account'
              )}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}

export { DeleteAccountSection }