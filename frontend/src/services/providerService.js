import { toServiceError } from '@/lib/apiError'

import apiClient from './apiClient'

/**
 * GET /api/providers/ — public, no auth required.
 *
 * Backend (providers/views.py ProviderListView) wraps the list in the
 * shared envelope with a top-level `count` alongside `data`, per the
 * API Contract:
 *   { status: "success", count: 24, data: [ { id, name, area,
 *     experience, photo, categories, avg_rating, review_count,
 *     status }, ... ] }
 *
 * category/area/sort are only added to the query string when they're
 * actually set, so "All categories" / an empty area box doesn't send
 * ?category=&area= for the backend to no-op on.
 *
 *   const { data, count } = await getProviders({ category: '1', area: 'Dhanmondi', sort: 'rating' })
 */
export async function getProviders({ category, area, sort } = {}) {
  const params = {}
  if (category) params.category = category
  if (area) params.area = area
  if (sort) params.sort = sort

  const response = await apiClient.get('/providers/', { params })
  return {
    data: response.data?.data ?? [],
    count: response.data?.count ?? 0,
  }
}

/**
 * POST /api/providers/profile/ — Day 5, Dev 3 (frontend side of Dev
 * 2's Day 4 endpoint).
 *
 * Auth required (apiClient's interceptor already attaches the JWT —
 * see apiClient.js). Backend (providers/serializers.py
 * ProviderProfileSetupSerializer) expects multipart/form-data because
 * `photo` is an optional file upload:
 *
 *   categories[]  — repeated field, one entry per selected category id
 *   area          — string
 *   experience    — integer (years)
 *   description   — string, optional
 *   photo         — File, optional
 *
 * Returns the raw envelope on success:
 *   { status: "success", message: "Profile submitted for review" }
 *
 * On failure, throws a normalized Error (see lib/apiError.js) whose
 * `.errors` (when present) is the raw DRF field-error map, e.g.
 *   { categories: ["Invalid category id(s): [9999]"] }
 */
export async function setupProviderProfile({ categories, area, experience, description, photo }) {
  const formData = new FormData()
  categories.forEach((categoryId) => formData.append('categories', categoryId))
  formData.append('area', area)
  formData.append('experience', experience)
  if (description) formData.append('description', description)
  if (photo) formData.append('photo', photo)

  try {
    const { data } = await apiClient.post('/providers/profile/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  } catch (error) {
    throw toServiceError(error)
  }
}

export default { getProviders, setupProviderProfile }