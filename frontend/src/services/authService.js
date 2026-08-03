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