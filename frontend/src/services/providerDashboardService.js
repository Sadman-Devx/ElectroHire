import apiClient from './apiClient'

/**
 * GET /api/providers/dashboard/ — Auth required (provider only).
 *
 * Not in the original API Contract — forward-declared here the same
 * way contactService.js was forward-declared on Day 6 before Dev 2's
 * Contact API existed (same day, landed a few hours apart). The
 * schedule adds this exact route on Day 9, Dev 2 ("Provider Dashboard
 * API — GET /api/providers/dashboard/ — Stats: contacts_count,
 * ratings_count, avg_rating — Recent Messages Preview (Last 3)"), so
 * the field names below are written to match that spec exactly.
 *
 * Until that route is registered, this 404s — useProviderDashboard()
 * treats a 404 here as "not built yet" (same handling
 * useContactProvider.js already gives a missing /api/contacts/), not
 * as an error, so the dashboard page degrades to an honest "not
 * available yet" empty state instead of a crash or fabricated numbers.
 *
 * Expected response shape once Day 9, Dev 2 lands it:
 *   { status: "success",
 *     data: {
 *       contacts_count: 38,
 *       ratings_count: 24,
 *       avg_rating: 4.8,
 *       recent_messages: [
 *         { id, sender_name, content, created_at, is_read }, ...
 *       ]
 *     } }
 */
export async function getProviderDashboard() {
  const response = await apiClient.get('/providers/dashboard/')
  return response.data?.data ?? null
}

export default { getProviderDashboard }