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

export default { createContact }