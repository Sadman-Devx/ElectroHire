import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, BadgeCheck, CheckCircle2, ClipboardEdit } from 'lucide-react'

import { Footer } from '@/components/home/Footer'
import { Navbar } from '@/components/home/Navbar'
import { ProviderOnlyNotice } from '@/components/providers/ProviderOnlyNotice'
import { CategoryMultiSelect } from '@/components/providers/setup/CategoryMultiSelect'
import { PhotoDropzone } from '@/components/providers/setup/PhotoDropzone'
import { ProviderStatusBadge } from '@/components/providers/status/ProviderStatusBadge'
import { FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/useAuth'
import { useCategories } from '@/hooks/useCategories'
import { useProviderMyProfile } from '@/hooks/useProviderMyProfile'
import { useProviderProfileSetup } from '@/hooks/useProviderProfileSetup'
import { hasErrors, validateProviderProfileForm } from '@/lib/validators'

const EMPTY_VALUES = {
  categories: [],
  area: '',
  experience: '',
  description: '',
  photo: null,
}

/**
 * Day 9 — Dev 3: Provider Profile Edit Page.
 *   → Category Edit (Multiple), Area, Experience Edit
 *   → Verified/Active Badge দেখাবে
 *
 * Route: /provider/profile-edit — rendered behind <ProtectedRoute>
 * (App.jsx). Reuses the exact same form controls
 * (CategoryMultiSelect/PhotoDropzone) and submit endpoint
 * (POST /api/providers/profile/ via useProviderProfileSetup) as
 * ProviderProfileSetupPage (Day 5, Dev 3) — the backend serializer
 * already treats every write as create-or-update
 * (ProviderProfileSetupSerializer.save uses update_or_create), so
 * this page only adds: pre-filling the form from GET
 * /api/providers/me/, and the Verified/status badges that endpoint
 * makes possible.
 *
 * Three non-happy-path states, in the order they're checked:
 *   1. Signed in as a "user" account       → ProviderOnlyNotice
 *   2. No Provider row yet (403 from /me/)  → "complete your profile" nudge
 *   3. A genuine /me/ failure (non-403)     → error banner
 * Only once none of those apply does the real edit form render.
 */
function ProviderProfileEditPage() {
  const { user } = useAuth()
  const { profile, isLoading: isLoadingProfile, error: profileError, isSetUp } =
    useProviderMyProfile()
  const { categories, isLoading: isLoadingCategories, error: categoriesError } = useCategories()
  const { submit, isSubmitting, error: submitError, fieldErrors, isSuccess } =
    useProviderProfileSetup()

  const [values, setValues] = useState(EMPTY_VALUES)
  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  // Tracks which profile object the form was last pre-filled from —
  // not just a boolean — so re-rendering never re-triggers this once
  // it's already run once for the profile that arrived. Adjusted
  // directly during render (React's documented pattern for "reset
  // state when a prop changes") rather than in a useEffect, so the
  // pre-fill lands in the very first commit instead of a follow-up
  // render, and a provider who's already started typing never has
  // their edits clobbered by a later effect run.
  const [prefilledFrom, setPrefilledFrom] = useState(null)

  if (profile && profile !== prefilledFrom) {
    setPrefilledFrom(profile)
    setValues({
      categories: profile.categories.map((category) => category.id),
      area: profile.area || '',
      experience: profile.experience != null ? String(profile.experience) : '',
      description: profile.description || '',
      photo: null,
    })
  }

  const errors = validateProviderProfileForm(values)

  function shouldShow(field) {
    return submitAttempted || touched[field]
  }

  function updateValue(field, value) {
    setValues((prev) => ({ ...prev, [field]: value }))
  }

  function markTouched(field) {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }

  function toggleCategory(categoryId) {
    markTouched('categories')
    setValues((prev) => {
      const isSelected = prev.categories.includes(categoryId)
      return {
        ...prev,
        categories: isSelected
          ? prev.categories.filter((id) => id !== categoryId)
          : [...prev.categories, categoryId],
      }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitAttempted(true)

    if (hasErrors(errors)) return

    await submit({
      categories: values.categories,
      area: values.area.trim(),
      experience: Number(values.experience),
      description: values.description.trim(),
      photo: values.photo,
    })
  }

  // ── 1. Not a provider account ────────────────────────────────────
  if (user && user.role !== 'provider') {
    return (
      <ProviderOnlyNotice description="You're signed in as a user account. Provider profile editing is only for accounts that signed up to offer a service." />
    )
  }

  // ── Success screen, after a save ─────────────────────────────────
  if (isSuccess) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <Card className="max-w-md p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-[var(--color-text)]">
              Profile updated and sent for review
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Your changes are saved. Since editing resubmits your profile for admin review,
              usually within 24&ndash;48 hours, it&rsquo;ll show as &ldquo;Pending review&rdquo;
              again until then.
            </p>
            <Link
              to="/provider/pending"
              className="mt-6 inline-block rounded-[var(--radius-button)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              View application status
            </Link>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // ── Loading the caller's current profile ─────────────────────────
  if (isLoadingProfile) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]" aria-live="polite">
            <Spinner /> Loading your profile…
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  // ── 2. Authenticated provider, but no Provider row yet ───────────
  if (!isSetUp) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <Card className="max-w-md p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-primary-tint)] text-[var(--color-primary-hover)]">
              <ClipboardEdit className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-[var(--color-text)]">
              You haven&rsquo;t set up your provider profile yet
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              There&rsquo;s nothing to edit yet — complete your provider profile first, and
              you&rsquo;ll be able to come back here to update it any time.
            </p>
            <Link
              to="/provider/profile-setup"
              className="mt-6 inline-block rounded-[var(--radius-button)] bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
            >
              Complete your profile
            </Link>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // ── 3. A genuine (non-403) failure loading the profile ───────────
  if (profileError) {
    return (
      <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
        <Navbar />
        <main className="flex flex-1 items-center justify-center px-4 py-16">
          <Card className="max-w-md p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-danger-tint)] text-[var(--color-danger)]">
              <AlertCircle className="h-7 w-7" />
            </span>
            <h1 className="mt-4 text-xl font-bold text-[var(--color-text)]">
              Couldn&rsquo;t load your profile
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">{profileError}</p>
          </Card>
        </main>
        <Footer />
      </div>
    )
  }

  // ── The real edit form ────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-bg)]">
      <Navbar />

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <Card className="p-6 sm:p-8">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-[var(--color-text)]">
                  Edit your provider profile
                </h1>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Update what customers see, then save to send it for review again.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {profile?.verified ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success)]/10 px-2.5 py-1 text-xs font-medium text-[var(--color-success)]">
                    <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    Verified
                  </span>
                ) : null}
                <ProviderStatusBadge status={profile?.status} />
              </div>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
              <div className="border-b border-[var(--color-border)] pb-6">
                <PhotoDropzone
                  file={values.photo}
                  existingPhotoUrl={profile?.photo ?? null}
                  onChange={(file) => {
                    updateValue('photo', file)
                    markTouched('photo')
                  }}
                  error={shouldShow('photo') ? errors.photo : null}
                  disabled={isSubmitting}
                />
              </div>

              <FormField
                id="categories"
                label="Service categories (select all that apply)"
                error={shouldShow('categories') ? errors.categories : null}
              >
                <CategoryMultiSelect
                  categories={categories}
                  selectedIds={values.categories}
                  onToggle={toggleCategory}
                  isLoading={isLoadingCategories}
                  error={categoriesError}
                />
              </FormField>

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField id="area" label="Service area" error={shouldShow('area') ? errors.area : null}>
                  <Input
                    id="area"
                    placeholder="e.g. Dhanmondi, Dhaka"
                    value={values.area}
                    invalid={Boolean(shouldShow('area') && errors.area)}
                    onChange={(e) => updateValue('area', e.target.value)}
                    onBlur={() => markTouched('area')}
                    disabled={isSubmitting}
                  />
                </FormField>

                <FormField
                  id="experience"
                  label="Years of experience"
                  error={shouldShow('experience') ? errors.experience : null}
                >
                  <Input
                    id="experience"
                    inputMode="numeric"
                    placeholder="e.g. 5"
                    value={values.experience}
                    invalid={Boolean(shouldShow('experience') && errors.experience)}
                    onChange={(e) => updateValue('experience', e.target.value.replace(/[^\d]/g, ''))}
                    onBlur={() => markTouched('experience')}
                    disabled={isSubmitting}
                  />
                </FormField>
              </div>

              <FormField id="description" label="About you">
                <Textarea
                  id="description"
                  placeholder="Describe your skills, experience and the services you offer..."
                  value={values.description}
                  onChange={(e) => updateValue('description', e.target.value)}
                  disabled={isSubmitting}
                  rows={4}
                />
              </FormField>

              {submitError ? (
                <div
                  role="alert"
                  className="rounded-[var(--radius-input)] bg-[var(--color-danger-tint)] px-3.5 py-2.5 text-sm font-medium text-[var(--color-danger)]"
                >
                  {submitError}
                  {fieldErrors ? (
                    <ul className="mt-1.5 list-disc pl-4 text-xs font-normal">
                      {Object.entries(fieldErrors).map(([field, messages]) => (
                        <li key={field}>
                          {Array.isArray(messages) ? messages.join(' ') : String(messages)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              <Button type="submit" size="lg" disabled={isSubmitting} className="w-full">
                {isSubmitting ? (
                  <>
                    <Spinner /> Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </form>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  )
}

export default ProviderProfileEditPage