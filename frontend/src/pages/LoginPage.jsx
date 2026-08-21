import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { AuthLayout } from '@/components/AuthLayout'
import { FormField } from '@/components/FormField'
import { PasswordInput } from '@/components/PasswordInput'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { validateLoginForm, hasErrors } from '@/lib/validators'
import { useAuth } from '@/context/useAuth'

const INITIAL_VALUES = { email: '', password: '' }

function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [values, setValues] = useState(INITIAL_VALUES)
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  const errors = validateLoginForm(values)

  function shouldShow(field) {
    return submitAttempted || touched[field]
  }

  function updateField(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }))
    if (submitError) setSubmitError(null)
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)
    setSubmitError(null)

    if (hasErrors(errors)) return

    setSubmitting(true)
    try {
      // login() calls POST /auth/login/, stores the returned JWT pair
      // in localStorage, and updates AuthContext's state — see
      // src/context/AuthContext.jsx. It resolves with that same
      // session (including role), so we can route straight to the
      // right dashboard without waiting for a re-render.
      //
      // Day 9, Dev 1/3: previously this always sent everyone to '/' —
      // fine for an anonymous visitor, but a signed-in provider has no
      // reason to land on the public "search for a technician" home
      // page, and neither does a returning user when a personalized
      // /dashboard already exists (Day 9, Dev 3). HomePage itself
      // bounces an already-authenticated visitor the same way, so this
      // also covers anyone who lands on /login while already logged in.
      const session = await login(values)
      navigate(session.role === 'provider' ? '/provider/dashboard' : '/dashboard', {
        replace: true,
      })
    } catch (error) {
      setSubmitError(error.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to your ElectroHire account"
      footer={
        <>
          Don&rsquo;t have an account?{' '}
          <Link to="/signup" className="font-semibold text-[var(--color-secondary)] hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <FormField id="email" label="Email address" error={shouldShow('email') ? errors.email : null}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={values.email}
            invalid={Boolean(shouldShow('email') && errors.email)}
            onChange={(e) => updateField('email', e.target.value)}
            onBlur={() => markTouched('email')}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          error={shouldShow('password') ? errors.password : null}
        >
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={values.password}
            invalid={Boolean(shouldShow('password') && errors.password)}
            onChange={(e) => updateField('password', e.target.value)}
            onBlur={() => markTouched('password')}
          />
        </FormField>

        {submitError ? (
          <div className="rounded-[var(--radius-input)] bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]">
            {submitError}
          </div>
        ) : null}

        <Button type="submit" size="lg" disabled={submitting} className="mt-1 w-full">
          {submitting ? (
            <>
              <Spinner /> Logging in…
            </>
          ) : (
            'Log in'
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default LoginPage