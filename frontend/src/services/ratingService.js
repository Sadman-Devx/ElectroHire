import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

/**
 * POST /api/ratings/ — Auth required.
 *
 * Day 8, Dev 3 (frontend side of Dev 2's Day 7 endpoint —
 * ratings/views.py RatingCreateView + ratings/serializers.py
 * RatingCreateSerializer).
 *
 * Eligibility ("must have contacted this provider before rating") is
 * enforced server-side, not here — a 400 with message "You must
 * contact this provider before rating" is a real, expected outcome
 * per the App Build doc's Step 8, not a bug. useSubmitRating()
 * surfaces that message as-is (via apiError.js) instead of masking it
 * with a generic failure string.
 *
 * `tags` must be a subset of ratings/serializers.py's ALLOWED_TAGS
 * ("on_time", "professional", "good_work", "fair_price") — anything
 * else is silently dropped server-side rather than rejected, so the
 * frontend (components/providers/rate/RatingTagSelector.jsx) only
 * ever offers exactly those four, keeping what the user sees selected
 * in sync with what actually gets saved.
 *
 * Request shape (per API Contract, Section 5):
 *   { provider_id: 1, rating_value: 4,
 *     review_text: "Very professional!", tags: ["on_time", "professional"] }
 * Response: { status: "success", message: "Rating submitted" }
 *
 *   await submitRating({ providerId: 1, ratingValue: 4, reviewText: '...', tags: ['on_time'] })
 */
export async function submitRating({ providerId, ratingValue, reviewText = '', tags = [] }) {
  try {
    const { data } = await apiClient.post('/ratings/', {
      provider_id: providerId,
      rating_value: ratingValue,
      review_text: reviewText,
      tags,
    })
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * GET /api/ratings/mine/ — Auth required.
 *
 * Day 9, Dev 1: not in the API Contract PDF — added to back the User
 * Account Page's "My Ratings" section. Every rating the caller has
 * submitted, newest first (ratings/views.py MyRatingListView).
 *
 * Response: { status: "success", count: N,
 *   data: [{ provider_id, provider_name, rating_value, review_text,
 *            tags, created_at }, ...] }
 *
 *   const myRatings = await getMyRatings()
 */
export async function getMyRatings() {
  try {
    const { data } = await apiClient.get('/ratings/mine/')
    return data?.data ?? []
  } catch (error) {
    throw toServiceError(error)
  }
}

export default { submitRating, getMyRatings }