/**
 * Shared axios-error → plain-Error normalizer.
 *
 * Originally lived only inside authService.js (Day 3, Dev 1). Pulled
 * out here (Day 5, Dev 3) so providerService.js's new
 * setupProviderProfile() doesn't duplicate the same ~15 lines a
 * second time — one implementation, every service module imports it.
 * Behavior is unchanged from the original: authService.js's own
 * tests still pass against this version untouched.
 *
 * Normalizes to a plain Error with:
 *   .message — user-facing text, taken from the API Contract's
 *              {"status": "error", "message": "..."} shape
 *   .status  — HTTP status code, or null if the request never
 *              reached the server
 *   .errors  — optional per-field errors, e.g. DRF serializer.errors
 *              ({"categories": ["Invalid category id(s): [9999]"]}),
 *              present on validation failures (400s) from endpoints
 *              that return them (see core/response.py error_response)
 *   .cause   — original axios error, for debugging
 */

const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const NETWORK_ERROR_MESSAGE = 'Network error. Please check your connection and try again.'

export function toServiceError(axiosError) {
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

export default { toServiceError }