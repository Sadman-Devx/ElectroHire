import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

/**
 * POST /api/contacts/ — Auth required.
 *
 * Backend for this (ContactLog model + view) is Dev 2's Day 6 task,
 * landing the same day as this file — same forward-declared pattern
 * Day 5 already used (ProviderCard linked to /providers/:id a full
 * day before this detail page existed). Until Dev 2's endpoint is
 * registered in electrohire/urls.py, this 404s; callers (see
 * useContactProvider) handle that with a friendly inline message
 * instead of a crash, and it starts working with zero frontend
 * changes the moment the backend route lands.
 *
 * Request/response shape straight from the API Contract:
 *   Request:  { "provider_id": 1 }
 *   Response: { status: "success",
 *               data: { contact_id: 15, provider_name: "Karim Uddin" } }
 *
 *   const { contact_id, provider_name } = await createContact({ providerId: 1 })
 */
export async function createContact({ providerId }) {
  try {
    const { data } = await apiClient.post('/contacts/', { provider_id: providerId })
    return data?.data ?? null
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/contacts/check/{provider_id}/ — Auth required.
 *
 * Day 9, Dev 1: not in the API Contract PDF — added to back the
 * Rating button's enable/disable state on ProviderDetailPage (Day 9
 * schedule: "Contact Log Eligibility Check"). Read-only — checking
 * does not itself create a ContactLog (see contacts/views.py
 * ContactCheckView docstring), so calling this is always safe to do
 * speculatively when a provider's page loads.
 *
 * Response: { status: "success", data: { has_contacted: bool, provider_id } }
 *
 *   const { has_contacted } = await checkContactEligibility(providerId)
 */
export async function checkContactEligibility(providerId) {
  try {
    const { data } = await apiClient.get(`/contacts/check/${providerId}/`)
    return data?.data ?? { has_contacted: false, provider_id: providerId }
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/contacts/history/ — Auth required.
 *
 * Day 9, Dev 1: not in the API Contract PDF — added to back the User
 * Account Page's "Contact History" section. Every provider the caller
 * has ever contacted, newest first (contacts/views.py ContactHistoryView).
 *
 * Response: { status: "success", count: N,
 *   data: [{ provider_id, provider_name, provider_area, provider_photo,
 *            contacted_at }, ...] }
 *
 *   const history = await getContactHistory()
 */
export async function getContactHistory() {
  try {
    const { data } = await apiClient.get('/contacts/history/')
    return data?.data ?? []
  } catch (error) {
    throw toServiceError(error)
  }
}

export default { createContact, checkContactEligibility, getContactHistory }