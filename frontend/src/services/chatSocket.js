import { getAccessToken } from './tokenStorage'

/**
 * Thin wrapper around the browser's native WebSocket for one open chat
 * thread (backend: contacts/consumers.py ChatConsumer). Owns
 * connecting, reconnecting with backoff, and a tiny typed-event
 * surface — callers never touch a raw WebSocket or JSON.parse/stringify.
 *
 * Browsers' WebSocket API can't set an Authorization header, so the
 * JWT access token travels as ?token=... instead — the same token
 * apiClient.js already attaches to every REST call, just relocated to
 * the query string for this one connection type (see
 * ChatConsumer._authenticate's docstring on the backend).
 *
 *   const socket = connectChatSocket({
 *     providerId, withUserId,
 *     onMessage: (message) => ...,        // a new Message arrived
 *     onTyping: ({ user_id, is_typing }) => ...,
 *     onStatusChange: (status) => ...,    // 'connecting' | 'open' | 'closed' | 'error'
 *   })
 *   socket.sendTyping(true)
 *   socket.close()   // always call this on unmount/thread change
 */

const DEFAULT_HTTP_BASE_URL = 'http://127.0.0.1:8000/api'

function resolveWsBaseUrl() {
  // VITE_WS_BASE_URL lets a deployment point the socket somewhere
  // different from the REST API (e.g. a dedicated WS ingress) — falls
  // back to deriving it from VITE_API_BASE_URL (http -> ws, and the
  // trailing /api stripped, since /ws/... is a sibling of /api/..., not
  // nested under it — see electrohire/urls.py + asgi.py).
  const explicit = import.meta.env.VITE_WS_BASE_URL
  if (explicit) return explicit.replace(/\/$/, '')

  const httpBase = import.meta.env.VITE_API_BASE_URL || DEFAULT_HTTP_BASE_URL
  return httpBase.replace(/^http/, 'ws').replace(/\/api\/?$/, '')
}

// Capped exponential-ish backoff — quick to recover from a blip,
// never hammers the server if it's genuinely down.
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10000]

export function connectChatSocket({ providerId, withUserId, onMessage, onTyping, onStatusChange }) {
  let socket = null
  let reconnectAttempt = 0
  let reconnectTimer = null
  let isClosedByCaller = false

  function buildUrl() {
    const token = getAccessToken()
    const params = new URLSearchParams({ token: token || '' })
    if (withUserId) params.set('with', String(withUserId))
    return `${resolveWsBaseUrl()}/ws/chat/${providerId}/?${params.toString()}`
  }

  function scheduleReconnect() {
    if (isClosedByCaller) return
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)]
    reconnectAttempt += 1
    reconnectTimer = window.setTimeout(connect, delay)
  }

  function connect() {
    onStatusChange?.('connecting')
    socket = new WebSocket(buildUrl())

    socket.onopen = () => {
      reconnectAttempt = 0
      onStatusChange?.('open')
    }

    socket.onmessage = (event) => {
      let payload
      try {
        payload = JSON.parse(event.data)
      } catch {
        return // Malformed frame — ignore rather than throw.
      }
      if (payload.type === 'message') onMessage?.(payload.message)
      else if (payload.type === 'typing') onTyping?.(payload)
    }

    socket.onclose = () => {
      onStatusChange?.('closed')
      if (!isClosedByCaller) scheduleReconnect()
    }

    socket.onerror = () => {
      // A native WebSocket always fires onclose right after onerror —
      // reconnection is scheduled there; this is just a status hook so
      // the UI can show "reconnecting" instead of a silent stall.
      onStatusChange?.('error')
    }
  }

  connect()

  return {
    sendTyping(isTyping) {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'typing', is_typing: isTyping }))
      }
    },
    close() {
      isClosedByCaller = true
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      socket?.close()
    },
  }
}

export default { connectChatSocket }