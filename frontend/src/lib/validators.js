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