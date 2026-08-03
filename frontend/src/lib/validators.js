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