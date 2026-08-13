import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

/**
 * POST /api/reports/ — Auth required.
 *
 * Day 8, Dev 3 (frontend side of Dev 2's Day 8 endpoint —
 * reports/views.py ReportCreateView + reports/serializers.py
 * ReportCreateSerializer).
 *
 * The backend model is bidirectional (reported_type: "provider" |
 * "user" — see reports/models.py's docstring on the "Report Feature
 * Bidirectional (User <-> Provider)" edge case), but today's UI
 * (pages/ReportProviderPage.jsx, route /providers/:id/report) only
 * ever sends reported_type: "provider" with reported_id = the
 * Provider's own id (same id used everywhere else, e.g.
 * /providers/{id}/) — reporting a user from the chat window is left
 * for a future page; ChatWindowHeader's report menu only links here
 * when the other party in the thread is a provider.
 *
 * Request shape (per API Contract, Section 6):
 *   { reported_id: 1, reported_type: "provider",
 *     reason: "fake", details: "This person is not real..." }
 * Response: { status: "success", message: "Report submitted. We will review within 24-48 hours." }
 *
 *   await submitReport({ reportedId: 1, reportedType: 'provider', reason: 'fake', details: '...' })
 */
export async function submitReport({ reportedId, reportedType, reason, details = '' }) {
  try {
    const { data } = await apiClient.post('/reports/', {
      reported_id: reportedId,
      reported_type: reportedType,
      reason,
      details,
    })
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

export default { submitReport }
