/**
 * Real auth service — Day 3, Dev 1 wires the Day 2 mock up to the
 * actual backend:
 *
 *   register(payload) -> POST /auth/register/
 *   login(payload)     -> POST /auth/login/
 *
 * Both keep the exact same call signature and throw/return shape the
 * mock used ({status, message} / {status, message, data} on success;
 * an Error with .message + .status on failure), so SignupPage's and
 * LoginPage's existing error handling didn't need to change — only
 * what happens inside these two functions did.
 *
 * Day 5, Dev 3: error normalization moved to the shared
 * `lib/apiError.js` (providerService.js now needs the exact same
 * logic) — behavior here is unchanged, just de-duplicated.
 */

import { toServiceError } from '@/lib/apiError'

import { apiClient } from './apiClient'

/**
 * @param {{name: string, email: string, phone: string, password: string, role: 'user'|'provider'}} payload
 * @returns {Promise<{status: string, message: string}>}
 */
export async function register(payload) {
  try {
    const { data } = await apiClient.post('/auth/register/', payload)
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * @param {{email: string, password: string}} payload
 * @returns {Promise<{status: string, data: {access_token: string, refresh_token: string, role: string, name: string}}>}
 */
export async function login(payload) {
  try {
    const { data } = await apiClient.post('/auth/login/', payload)
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function verifyOtp(payload) {
  try {
    const { data } = await apiClient.post('/auth/verify-otp/', payload)
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

export async function resendOtp(payload) {
  try {
    const { data } = await apiClient.post('/auth/resend-otp/', payload)
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/auth/me/ — Auth required.
 *
 * Day 9, Dev 1: not in the API Contract PDF — added to back the User
 * Account Page's "Profile Info" section. Always the *caller's own*
 * record (users/views.py MeView) — there's no id parameter to pass.
 *
 * Response: { status: "success",
 *   data: { id, name, email, phone, role, verified, member_since } }
 *
 *   const profile = await getMyProfile()
 */
export async function getMyProfile() {
  try {
    const { data } = await apiClient.get('/auth/me/')
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * POST /api/auth/forgot-password/ — no auth required.
 * Body: {"email": "..."}
 *
 * Not in the API Contract PDF — backs the Forgot Password page.
 * Backend (users/views.py ForgotPasswordView) always returns the same
 * generic success message whether or not the account exists (or is
 * verified) — same "don't confirm/deny an email is registered"
 * reasoning ResendOTPView already uses — so this never throws for a
 * "no such account" case, only for a malformed request or a genuine
 * network/server failure.
 *
 * Response: { status: "success", message: "If an account exists for
 *   this email, a password reset code has been sent" }
 *
 *   const { message } = await forgotPassword({ email })
 */
export async function forgotPassword({ email }) {
  try {
    const { data } = await apiClient.post('/auth/forgot-password/', { email })
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * POST /api/auth/reset-password/ — no auth required.
 * Body: {"email": "...", "otp": "123456", "new_password": "..."}
 *
 * Not in the API Contract PDF — backs the Reset Password page.
 * Backend (users/views.py ResetPasswordView) deliberately does NOT
 * log the user in afterwards (no access/refresh token in the
 * response) — the frontend sends them to /login with their new
 * password instead of trusting the just-used OTP as an implicit
 * login, so this resolves with just the confirmation message.
 *
 * Response: { status: "success", message: "Password has been reset. Please log in." }
 *
 *   const { message } = await resetPassword({ email, otp, newPassword })
 */
export async function resetPassword({ email, otp, newPassword }) {
  try {
    const { data } = await apiClient.post('/auth/reset-password/', {
      email,
      otp,
      new_password: newPassword,
    })
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * DELETE /api/auth/account/ — Auth required.
 * Body: {"password": "..."}
 *
 * Not in the API Contract PDF — backs the Account Page's "Delete
 * account" danger-zone action. Backend (users/views.py
 * AccountDeleteView) always deletes the *caller's own* account (no id
 * parameter) and requires the current password as re-confirmation —
 * a stolen/leaked access token alone isn't enough to permanently
 * delete an account.
 *
 * On success the caller's row (and, per CASCADE, their provider
 * profile/contacts/messages/ratings/reports/bookings) is gone —
 * apiClient's own JWT is now worthless (SimpleJWT can't resolve the
 * deleted user id), so the caller must also clear the local session
 * afterwards (see useDeleteAccount, which calls AuthContext's
 * logout() immediately after this resolves).
 *
 * Response: { status: "success", message: "Account deleted" }
 *
 *   const { message } = await deleteAccount({ password })
 */
export async function deleteAccount({ password }) {
  try {
    const { data } = await apiClient.delete('/auth/account/', { data: { password } })
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * POST /api/auth/change-password/ — Auth required.
 * Body: {"current_password": "...", "new_password": "..."}
 *
 * Not in the API Contract PDF — backs the Account Page's "Change
 * Password" action. Backend (users/views.py ChangePasswordView) is
 * the "I know my password and just want to update it" counterpart to
 * forgotPassword/resetPassword above (which exist precisely for when
 * the caller *doesn't* know their password) — requires the current
 * password as re-confirmation, same as deleteAccount does for its own
 * destructive action.
 *
 * Does NOT clear the local session or log the caller out — the
 * backend deliberately leaves the current access/refresh token pair
 * working (see ChangePasswordView's own docstring), so unlike
 * deleteAccount there is nothing for a caller of this function to
 * clean up in tokenStorage.js afterwards.
 *
 * Response: { status: "success", message: "Password changed successfully" }
 *
 *   const { message } = await changePassword({ currentPassword, newPassword })
 */
export async function changePassword({ currentPassword, newPassword }) {
  try {
    const { data } = await apiClient.post('/auth/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    })
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

export default {
  register,
  login,
  verifyOtp,
  resendOtp,
  getMyProfile,
  forgotPassword,
  resetPassword,
  deleteAccount,
  changePassword,
}