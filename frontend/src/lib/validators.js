// Kept in sync with backend/users/serializers.py — same phone pattern,
// same password minimum, same "must pick a role" rule — so a form that
// passes here won't turn around and fail once Day 3 wires up the real
// POST /api/auth/register/ call.

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BD_PHONE_REGEX = /^01[3-9]\d{8}$/

export function validateName(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Name is required'
  if (trimmed.length < 2) return 'Name must be at least 2 characters'
  return null
}

export function validateEmail(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Email is required'
  if (!EMAIL_REGEX.test(trimmed)) return 'Enter a valid email address'
  return null
}

export function validatePhone(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Phone number is required'
  if (!BD_PHONE_REGEX.test(trimmed)) {
    return 'Enter a valid Bangladeshi mobile number, e.g. 01712345678'
  }
  return null
}

export function validatePassword(value) {
  if (!value) return 'Password is required'
  if (value.length < 8) return 'Password must be at least 8 characters'
  return null
}

export function validateRole(value) {
  if (!value) return 'Choose whether you need a service or offer one'
  return null
}

export function validateSignupForm(values) {
  return {
    name: validateName(values.name),
    email: validateEmail(values.email),
    phone: validatePhone(values.phone),
    password: validatePassword(values.password),
    role: validateRole(values.role),
  }
}

export function validateLoginForm(values) {
  return {
    email: validateEmail(values.email),
    password: (values.password || '').trim() ? null : 'Password is required',
  }
}

export function hasErrors(errors) {
  return Object.values(errors).some(Boolean)
}

// ── Day 5, Dev 3: Provider Profile Setup ────────────────────────────
// Kept in sync with backend/providers/serializers.py
// (ProviderProfileSetupSerializer) — same required fields, same
// numeric floor, same max photo constraints — so a form that passes
// here won't turn around and fail the real
// POST /api/providers/profile/ call.

const MAX_AREA_LENGTH = 100 // matches Provider.area = CharField(max_length=100)
const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB client-side ceiling
const ACCEPTED_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export function validateProviderCategories(value) {
  if (!Array.isArray(value) || value.length === 0) {
    return 'Select at least one service category'
  }
  return null
}

export function validateProviderArea(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Service area is required'
  if (trimmed.length > MAX_AREA_LENGTH) {
    return `Service area must be ${MAX_AREA_LENGTH} characters or fewer`
  }
  return null
}

/**
 * @param {string} value — raw text from the "Years of experience" input
 */
export function validateProviderExperience(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Years of experience is required'
  if (!/^\d+$/.test(trimmed)) return 'Enter a whole number of years'
  if (Number(trimmed) < 0) return 'Experience cannot be negative'
  return null
}

/**
 * @param {File|null} file — null/undefined is valid (photo is optional)
 */
export function validateProviderPhoto(file) {
  if (!file) return null
  if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
    return 'Photo must be a JPG, PNG, or WEBP image'
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return 'Photo must be smaller than 5MB'
  }
  return null
}

export function validateProviderProfileForm(values) {
  return {
    categories: validateProviderCategories(values.categories),
    area: validateProviderArea(values.area),
    experience: validateProviderExperience(values.experience),
    photo: validateProviderPhoto(values.photo),
  }
}

// ── Day 11: Forgot / Reset Password ─────────────────────────────────
// Kept in sync with backend/users/serializers.py ResetPasswordSerializer
// — same 6-digit OTP shape, same validate_password() minimum a fresh
// signup would already require — so a form that passes here won't
// turn around and fail the real POST /api/auth/reset-password/ call.

export function validateOtpCode(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Enter the 6-digit code'
  if (!/^\d{6}$/.test(trimmed)) return 'Enter the 6-digit code exactly as emailed to you'
  return null
}

/**
 * @param {string} value — the new password itself
 * @param {string} confirmValue — the "confirm new password" field
 */
export function validateConfirmPassword(value, confirmValue) {
  if (!confirmValue) return 'Confirm your new password'
  if (value !== confirmValue) return 'Passwords do not match'
  return null
}

export function validateForgotPasswordForm(values) {
  return {
    email: validateEmail(values.email),
  }
}

export function validateResetPasswordForm(values) {
  return {
    email: validateEmail(values.email),
    otp: validateOtpCode(values.otp),
    newPassword: validatePassword(values.newPassword),
    confirmPassword: validateConfirmPassword(values.newPassword, values.confirmPassword),
  }
}

// ── Day 11: Account Delete ──────────────────────────────────────────
// Backend (AccountDeleteSerializer) only shape-checks "present,
// non-empty" — the real check is check_password() against the
// caller's actual current password, which no client-side rule can
// replicate. This exists purely so an empty submit shows an inline
// message instead of a wasted round trip.
export function validateCurrentPassword(value) {
  if (!value) return 'Enter your current password to confirm'
  return null
}

// ── Day 12: Change Password ──────────────────────────────────────────
// Reuses validateCurrentPassword/validatePassword/validateConfirmPassword
// as-is — same three checks Reset Password's own form already needs,
// just applied to a "logged in and know your current password" form
// instead of an OTP-based one.
export function validateChangePasswordForm(values) {
  return {
    currentPassword: validateCurrentPassword(values.currentPassword),
    newPassword: validatePassword(values.newPassword),
    confirmPassword: validateConfirmPassword(values.newPassword, values.confirmPassword),
  }
}

// ── Day 11: Provider Booking ─────────────────────────────────────────
// Kept in sync with backend/bookings/serializers.py
// BookingCreateSerializer — same required fields, same "not in the
// past" date/time rule — so a form that passes here won't turn around
// and fail the real POST /api/bookings/ call.

const MAX_BOOKING_ADDRESS_LENGTH = 255 // matches Booking.address = CharField(max_length=255)
const MAX_BOOKING_DESCRIPTION_LENGTH = 2000 // matches BookingCreateSerializer.description

export function validateBookingDate(value) {
  if (!value) return 'Select a date'
  // Compares by local calendar date, not timestamp, so "today" itself
  // is always a valid choice regardless of the current time of day —
  // the paired time field is what actually catches an already-passed
  // slot on today's date (see validateBookingTime below).
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const chosen = new Date(`${value}T00:00:00`)
  if (Number.isNaN(chosen.getTime())) return 'Enter a valid date'
  if (chosen < today) return 'Scheduled date cannot be in the past'
  return null
}

export function validateBookingTime(value, dateValue) {
  if (!value) return 'Select a time'
  if (!dateValue) return null

  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  if (dateValue !== todayIso) return null

  const [hours, minutes] = value.split(':').map(Number)
  const chosen = new Date(today)
  chosen.setHours(hours, minutes, 0, 0)
  if (chosen < today) return 'Scheduled time cannot be in the past'
  return null
}

export function validateBookingAddress(value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return 'Address is required'
  if (trimmed.length > MAX_BOOKING_ADDRESS_LENGTH) {
    return `Address must be ${MAX_BOOKING_ADDRESS_LENGTH} characters or fewer`
  }
  return null
}

export function validateBookingDescription(value) {
  const trimmed = (value || '').trim()
  if (trimmed.length > MAX_BOOKING_DESCRIPTION_LENGTH) {
    return `Description must be ${MAX_BOOKING_DESCRIPTION_LENGTH} characters or fewer`
  }
  return null
}

export function validateBookingForm(values) {
  return {
    scheduledDate: validateBookingDate(values.scheduledDate),
    scheduledTime: validateBookingTime(values.scheduledTime, values.scheduledDate),
    address: validateBookingAddress(values.address),
    description: validateBookingDescription(values.description),
  }
}