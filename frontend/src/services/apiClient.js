import axios from 'axios'

import { clearSession, getAccessToken, getRefreshToken, updateAccessToken } from './tokenStorage'

// Base URL comes from the environment so dev/staging/prod can point at
// different backends without a code change. Falls back to the local
// Django dev server (see backend/README.md).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attaches the stored JWT (if any) to every outgoing request, so
// authenticated endpoints built on later days (provider profile
// setup, contacts, chat, ratings, ...) work without every call site
// having to remember to add the header itself. Requests made before
// login (register/login themselves) simply have no token yet, so this
// is a no-op for them.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/**
 * Day 9, Dev 1: JWT Token Refresh Logic.
 *
 * SIMPLE_JWT.ACCESS_TOKEN_LIFETIME is 30 minutes (backend/electrohire/settings.py),
 * so any session older than that starts getting 401s on every
 * authenticated call unless something silently refreshes it. This
 * response interceptor does that transparently: on a 401, it exchanges
 * the stored refresh token for a new access token
 * (POST /api/auth/refresh/ — users/views.py RefreshTokenView, also new
 * today) and retries the original request exactly once.
 *
 * A handful of deliberate guards keep this from looping or firing
 * where it shouldn't:
 *   - `_retry` flag on the request config — retried requests never
 *     trigger a second refresh attempt, so a 401 that persists even
 *     with a fresh access token fails cleanly instead of looping.
 *   - AUTH_ENDPOINTS_EXCLUDED_FROM_REFRESH — /auth/login/, /auth/register/,
 *     /auth/verify-otp/, /auth/resend-otp/, and /auth/refresh/ itself
 *     never trigger a refresh attempt on a 401. A 401 from the refresh
 *     endpoint means the refresh token itself is dead — attempting to
 *     "refresh" that would recurse forever; the other four are
 *     pre-login endpoints where a 401 is either impossible or means
 *     something unrelated to an expired session.
 *   - `refreshPromise` singleton — if several requests 401 at once
 *     (e.g. a page that fires 3 parallel GETs right as the token
 *     expires), only the first triggers a real POST /api/auth/refresh/
 *     call; the rest await that same in-flight promise instead of each
 *     starting their own.
 *
 * If the refresh call itself fails (refresh token expired/invalid —
 * REFRESH_TOKEN_LIFETIME is 7 days), the stored session is cleared and
 * a DOM event is dispatched instead of importing AuthContext directly
 * here — apiClient.js has no React dependency today and this keeps it
 * that way. AuthContext listens for this event (see AuthContext.jsx)
 * and flips its own state to logged-out, which is what actually makes
 * ProtectedRoute redirect to /login; clearing localStorage alone
 * wouldn't update AuthContext's already-mounted React state.
 */
const AUTH_ENDPOINTS_EXCLUDED_FROM_REFRESH = [
  '/auth/login/',
  '/auth/register/',
  '/auth/verify-otp/',
  '/auth/resend-otp/',
  '/auth/refresh/',
]

export const SESSION_EXPIRED_EVENT = 'electrohire:session-expired'

let refreshPromise = null

function isExcludedFromRefresh(url = '') {
  return AUTH_ENDPOINTS_EXCLUDED_FROM_REFRESH.some((path) => url.includes(path))
}

async function refreshAccessTokenOnce() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token available')

  // A bare axios call, not apiClient — going through apiClient here
  // would re-enter this same response interceptor.
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
    refresh_token: refreshToken,
  })
  const newAccessToken = data.data.access_token
  updateAccessToken(newAccessToken)
  return newAccessToken
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const status = error.response?.status

    if (
      status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isExcludedFromRefresh(originalRequest.url)
    ) {
      return Promise.reject(error)
    }

    originalRequest._retry = true

    try {
      refreshPromise = refreshPromise || refreshAccessTokenOnce()
      const newAccessToken = await refreshPromise
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
      return apiClient(originalRequest)
    } catch {
      clearSession()
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
      return Promise.reject(error)
    } finally {
      refreshPromise = null
    }
  }
)

export default apiClient