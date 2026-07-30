import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { MailCheck } from 'lucide-react'

import { AuthLayout } from '@/components/AuthLayout'
import { OtpInput } from '@/components/OtpInput'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/useAuth'
import { useCountdown } from '@/lib/useCountdown'
import { resendOtp, verifyOtp } from '@/services/authService'

const OTP_LENGTH = 6
const COUNTDOWN_SECONDS = 5 * 60

function VerifyOtpPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { completeOtpVerification } = useAuth()
  const email = location.state?.email

  const { secondsLeft, isExpired, restart, formatted } = useCountdown(COUNTDOWN_SECONDS)

  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState(null)
  const [resending, setResending] = useState(false)
  const [resendNotice, setResendNotice] = useState(null)

  if (!email) {
    return <Navigate to="/signup" replace />
  }

  function handleOtpChange(nextValue) {
    setOtp(nextValue)
    if (verifyError) setVerifyError(null)
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (otp.length !== OTP_LENGTH || verifying) return

    setVerifying(true)
    setVerifyError(null)
    try {
      const response = await verifyOtp({ email, otp })
      const { access_token: accessToken, refresh_token: refreshToken, role } = response.data
      completeOtpVerification({ accessToken, refreshToken, role })
      navigate('/', { replace: true })
    } catch (error) {
      setVerifyError(error.message || 'Invalid or expired OTP')
    } finally {
      setVerifying(false)
    }
  }

  async function handleResend() {
    if (!isExpired || resending) return

    setResending(true)
    setResendNotice(null)
    setVerifyError(null)
    try {
      await resendOtp({ email })
      setOtp('')
      restart()
      setResendNotice('A new code has been sent to your email.')
    } catch (error) {
      setVerifyError(error.message || 'Could not resend the code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle={
        <>
          Enter the 6-digit code we sent to <strong>{email}</strong>
        </>
      }
      footer={
        <>
          Wrong email?{' '}
          <Link to="/signup" className="font-semibold text-[var(--color-secondary)] hover:underline">
            Sign up again
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col items-center gap-5">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
          <MailCheck className="h-6 w-6" />
        </span>

        <OtpInput value={otp} onChange={handleOtpChange} disabled={verifying} error={Boolean(verifyError)} />

        <p className="text-sm text-[var(--color-text-muted)]" aria-live="polite">
          {isExpired ? 'Code expired.' : <>Code expires in <span className="font-semibold tabular-nums text-[var(--color-text)]">{formatted}</span></>}
        </p>

        {verifyError ? (
          <div className="w-full rounded-[var(--radius-input)] bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-center text-sm font-medium text-[var(--color-danger)]">
            {verifyError}
          </div>
        ) : null}

        {resendNotice ? (
          <div className="w-full rounded-[var(--radius-input)] bg-[var(--color-secondary-tint)] px-3.5 py-2.5 text-center text-sm font-medium text-[var(--color-secondary)]">
            {resendNotice}
          </div>
        ) : null}

        <Button type="submit" size="lg" disabled={otp.length !== OTP_LENGTH || verifying} className="w-full">
          {verifying ? <><Spinner /> Verifying…</> : 'Verify account'}
        </Button>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          disabled={!isExpired || resending}
          onClick={handleResend}
          className="w-full"
        >
          {resending ? <><Spinner /> Resending…</> : secondsLeft > 0 ? `Resend code (${formatted})` : 'Resend code'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default VerifyOtpPage