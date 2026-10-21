import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

// The backend allows the AI up to ~30s per attempt (and retries once
// on a malformed reply), so the default "no timeout" would leave the
// chat spinner hanging forever if something stalls.
const AI_TIMEOUT_MS = 75000

const TIMEOUT_MESSAGE = 'The AI is taking too long to answer. Please try again.'

/**
 * POST /api/assistant/analyze/ — Auth required (JWT is attached by
 * apiClient's interceptor). Phase 1 + 2 backend: assistant/views.py.
 *
 * Body: { problem, area? }   — area is optional and only used to
 * filter providers; blank/whitespace areas are not sent at all.
 *
 * Response `data`: { category, category_fallback, urgency, summary,
 *   safety_tips, cost_estimate, language, providers: { area,
 *   area_matched, matches, message, alternatives } }
 *
 *   const result = await analyzeProblem({ problem: 'Ceiling fan ghure na', area: 'Gulshan' })
 *
 * Throws a plain Error (message ready to show; .status set) via
 * toServiceError, the same contract every other service module uses.
 */
export async function analyzeProblem({ problem, area } = {}) {
  const body = { problem }
  const trimmedArea = typeof area === 'string' ? area.trim() : ''
  if (trimmedArea) body.area = trimmedArea

  try {
    const response = await apiClient.post('/assistant/analyze/', body, {
      timeout: AI_TIMEOUT_MS,
    })
    return response.data?.data ?? null
  } catch (error) {
    if (error?.code === 'ECONNABORTED') {
      const timeoutError = new Error(TIMEOUT_MESSAGE)
      timeoutError.status = null
      timeoutError.cause = error
      throw timeoutError
    }
    throw toServiceError(error)
  }
}

/**
 * POST /api/assistant/booking-draft/ — Auth required. Phase 4A backend:
 * assistant/views.py BookingDraftView.
 *
 * Body: { provider_id, message, problem_summary?, category_id? }
 *   message: the customer's own words, e.g. "kal shokal 10 tar, House 12 Road 5"
 *
 * Response `data`: { provider: {id, name, area}, draft: { provider_id,
 *   category_id, scheduled_date, scheduled_time, address, description },
 *   missing_fields, problems, ready, today, language }
 *
 * This only ever returns a DRAFT — it never creates a booking. A booking
 * is created solely by bookingService.createBooking(), which the UI
 * calls only when the customer presses Confirm.
 *
 *   const draft = await draftBooking({ providerId: 7, message: 'kal shokal 10 tar, House 12' })
 */
export async function draftBooking({ providerId, message, problemSummary, categoryId } = {}) {
  const body = { provider_id: providerId, message }
  if (problemSummary) body.problem_summary = problemSummary
  if (categoryId) body.category_id = categoryId

  try {
    const response = await apiClient.post('/assistant/booking-draft/', body, {
      timeout: AI_TIMEOUT_MS,
    })
    return response.data?.data ?? null
  } catch (error) {
    if (error?.code === 'ECONNABORTED') {
      const timeoutError = new Error(TIMEOUT_MESSAGE)
      timeoutError.status = null
      timeoutError.cause = error
      throw timeoutError
    }
    throw toServiceError(error)
  }
}

export default { analyzeProblem, draftBooking }
