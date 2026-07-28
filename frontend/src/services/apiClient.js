import axios from 'axios'

import { getAccessToken } from './tokenStorage'

// Base URL comes from the environment so dev/staging/prod can point at
// different backends without a code change. Falls back to the local
// Django dev server (see backend/README.md).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api'

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attaches the stored JWT (if any) to every outgoing request, so
// authenticated endpoints built on later days (provider profile
// setup, contacts, chat, ratings, ...) work without every call site
// having to remember to add the header itself. Requests made before
// login (register/login themselves) simply have no token yet, so this
// is a no-op for them.
apiClient.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default apiClient