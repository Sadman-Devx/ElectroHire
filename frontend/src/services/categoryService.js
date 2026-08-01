import apiClient from './apiClient'

/**
 * GET /api/categories/ — public, no auth required.
 *
 * Backend (categories/views.py) wraps every list in the shared
 * envelope, so a success response looks like:
 *   { status: "success", data: [ { id, name, icon }, ... ] }
 *
 * We only ever hand the `data` array back to the UI — components
 * should never need to know about the envelope shape.
 */
export async function getCategories() {
  const response = await apiClient.get('/categories/')
  return response.data?.data ?? []
}

export default { getCategories }