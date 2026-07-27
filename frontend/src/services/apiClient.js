import axios from 'axios'

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

export default apiClient