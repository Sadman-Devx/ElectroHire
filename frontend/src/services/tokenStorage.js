/**
 * Persists the logged-in session (JWT access/refresh tokens + basic
 * user info) to localStorage — Day 3, Dev 1: "JWT Token
 * localStorage-এ Store করো".
 *
 * Kept as a small, framework-free module (no React here) so it can be
 * used both by AuthContext (for state) and by apiClient (to read the
 * access token for the Authorization header) without either one
 * importing the other.
 *
 * Everything the session needs lives under ONE storage key as a single
 * JSON blob, rather than several separate keys — one read, one write,
 * no risk of the pieces getting out of sync with each other.
 */

const STORAGE_KEY = 'electrohire_auth_session'

/**
 * @returns {{accessToken: string, refreshToken: string, role: string, name: string|null} | null}
 */
export function getSession() {
  let raw
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    // localStorage can throw in some environments (privacy mode,
    // disabled storage, etc) — treat that the same as "logged out"
    // rather than crashing the app.
    return null
  }

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed.accessToken !== 'string' || !parsed.accessToken) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

/**
 * @param {{accessToken: string, refreshToken: string, role: string, name?: string|null}} session
 */
export function saveSession({ accessToken, refreshToken, role, name = null }) {
  const session = { accessToken, refreshToken, role, name }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  return session
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY)
}

export function getAccessToken() {
  return getSession()?.accessToken ?? null
}