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
 */

import { apiClient } from './apiClient'

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection and try again.'

/**
 * Normalizes an axios error into a plain Error with a user-facing
 * `.message` (taken straight from the API Contract's
 * {"status": "error", "message": "..."} shape) and a `.status` code,
 * so callers never have to know axios's error shape.
 */
function toServiceError(axiosError) {
  const response = axiosError.response

  if (!response) {
    // Request never reached the server (backend down, no network,
    // CORS misconfiguration, etc).
    const error = new Error(NETWORK_ERROR_MESSAGE)
    error.status = null
    error.cause = axiosError
    return error
  }

  const message = response.data?.message || GENERIC_ERROR_MESSAGE
  const error = new Error(message)
  error.status = response.status
  error.errors = response.data?.errors
  error.cause = axiosError
  return error
}

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