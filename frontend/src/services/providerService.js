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

export default { getProviders }