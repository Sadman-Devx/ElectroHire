import { useCallback, useEffect, useRef, useState } from 'react'

import { classifyFile, MESSAGE_TYPE } from '@/lib/chatAttachments'
import { connectChatSocket } from '@/services/chatSocket'
import { getMessageThread, sendMessage } from '@/services/chatService'

// Fallback only. Real-time delivery is the WebSocket (connectChatSocket)
// -- this interval is just a safety net in case a socket drop is
// somehow missed by its own reconnect logic (flaky network, a
// backgrounded tab throttled by the browser, etc), so it can be a lot
// longer than the old 5s poll now that the socket is doing the real
// work of "feels instant".
const FALLBACK_POLL_INTERVAL_MS = 20000

// How long the "typing…" indicator holds after the other party's last
// keystroke, in case their own "stopped typing" signal never arrives
// (tab closed mid-type, connection drop, etc).
const TYPING_INDICATOR_TIMEOUT_MS = 4000

/**
 * Loads the message thread for whichever conversation is open, keeps
 * it live via a WebSocket (contacts/consumers.py ChatConsumer), and
 * exposes send() to post a new message.
 *
 * Real-time behaviour:
 *   - `connectionStatus`: 'connecting' | 'open' | 'closed' | 'error' --
 *     drive a small status pill in the UI so people can tell the
 *     difference between "quiet conversation" and "actually disconnected".
 *   - `isOtherTyping`: true while the other party has an in-progress draft.
 *   - `notifyTyping(isTyping)`: call from the composer's onChange.
 *   - send() shows the message immediately (optimistic, marked
 *     `_pending`) instead of waiting on the network round trip, then
 *     reconciles it with the real one once the POST responds. If the
 *     other party (or this same tab, via the server's own broadcast
 *     echo) pushes a live update over the socket, the thread silently
 *     re-syncs from the server -- one source of truth for
 *     ordering/is_read, no hand-rolled merge logic.
 *
 * Attachments update: send() accepts either a plain string (text, as
 * before) or an object:
 *     send({ content?, attachment: File, messageType: 'image'|'file'|'voice', durationSeconds? })
 * An attachment bubble appears instantly using a local preview of the
 * file (`_localUrl`) with an upload progress value (`_progress`, 0..1),
 * and keeps everything needed to retry (`_retryPayload`) if the upload
 * fails. While an upload is in flight, background re-syncs are held
 * back and run once it finishes -- otherwise a re-sync landing
 * mid-upload would wipe the pending bubble off the screen.
 *
 *   const {
 *     messages, isLoading, error, send, isSending, sendError,
 *     connectionStatus, isOtherTyping, notifyTyping, retryFailedMessage,
 *   } = useChatThread(selectedConversation, user?.role, { onThreadOpened, onMessageSent })
 */
export function useChatThread(conversation, viewerRole, { onThreadOpened, onMessageSent } = {}) {
  const providerId = conversation?.provider_id ?? null
  const otherUserId = conversation?.other_user_id ?? null
  // Only a provider replying needs '?with=' to say which customer's
  // thread this is (see MessageListCreateView._resolve_other_user on
  // the backend). A provider's own conversations are always with
  // customers in this app's MVP scope, so role alone decides.
  const withUserId = viewerRole === 'provider' ? otherUserId : undefined

  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState(null)
  const [connectionStatus, setConnectionStatus] = useState('connecting')
  const [isOtherTyping, setIsOtherTyping] = useState(false)

  // Prevents a slow request (foreground or background poll) from
  // overlapping with the next tick and stacking up retries.
  const isFetchingRef = useRef(false)
  const socketRef = useRef(null)
  const typingClearTimerRef = useRef(null)

  // Attachment upload bookkeeping (see header comment).
  const uploadsInFlightRef = useRef(0)
  const resyncAfterUploadRef = useRef(false)
  const refreshThreadRef = useRef(null)
  // Local blob: URLs created for pending bubbles, so they can be
  // released (browsers keep the file in memory until revoked).
  const localUrlsRef = useRef(new Set())

  // onThreadOpened/onMessageSent come from useConversations(), whose
  // markThreadRead/applySentMessage are plain functions, not
  // useCallback-memoized -- so their identity changes on every render
  // of that hook (including its own unrelated 5s poll). Routing them
  // through refs (updated every render, but never *read* during
  // render) keeps loadThread's own identity -- and therefore the
  // WebSocket-connecting effect below -- stable across those
  // unrelated re-renders. Without this, the socket would disconnect
  // and reconnect constantly instead of staying open, defeating the
  // entire point of a persistent real-time connection.
  const onThreadOpenedRef = useRef(onThreadOpened)
  const onMessageSentRef = useRef(onMessageSent)
  useEffect(() => {
    onThreadOpenedRef.current = onThreadOpened
    onMessageSentRef.current = onMessageSent
  })

  // Free any remaining local previews when the chat is closed.
  useEffect(() => {
    const localUrls = localUrlsRef.current
    return () => {
      localUrls.forEach((url) => URL.revokeObjectURL(url))
      localUrls.clear()
    }
  }, [])

  // Single effect owning the whole "this conversation is open" lifecycle:
  // initial load, the 20s fallback poll, and the WebSocket. All three
  // share one locally-defined `loadThread` (rather than a hoisted
  // useCallback) so its synchronous setState-on-call is the standard
  // "synchronize on mount" effect pattern, and so the poll/socket
  // cleanup below is guaranteed to tear down together, no separate
  // effects to keep in sync with each other.
  useEffect(() => {
    if (!providerId || !otherUserId) return undefined

    let isMounted = true

    async function loadThread({ silent = false } = {}) {
      // An attachment is uploading: replacing the list now would drop
      // its pending bubble. Remember to re-sync once it finishes.
      if (silent && uploadsInFlightRef.current > 0) {
        resyncAfterUploadRef.current = true
        return
      }
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      if (!silent) {
        setIsLoading(true)
        setError(null)
      }
      try {
        const data = await getMessageThread({ providerId, withUserId })
        if (isMounted) {
          // A failed *attachment* is kept on screen (it holds the file
          // the person picked / the voice note they recorded) so a
          // re-sync can't silently throw it away before they retry.
          setMessages((current) => [
            ...data,
            ...current.filter((message) => message._failed && message._retryPayload),
          ])
          if (!silent) onThreadOpenedRef.current?.(otherUserId)
        }
      } catch (err) {
        // A silent background refresh failing (brief network blip,
        // etc) shouldn't rip a working conversation view out from
        // under someone mid-read to show an error banner -- only the
        // foreground load surfaces errors.
        if (isMounted && !silent) {
          setError(err.message || 'Could not load this conversation. Please try again.')
        }
      } finally {
        isFetchingRef.current = false
        if (isMounted && !silent) setIsLoading(false)
      }
    }

    refreshThreadRef.current = () => loadThread({ silent: true })

    loadThread()
    const intervalId = window.setInterval(() => loadThread({ silent: true }), FALLBACK_POLL_INTERVAL_MS)

    const socket = connectChatSocket({
      providerId,
      withUserId,
      onStatusChange: setConnectionStatus,
      onMessage: () => {
        // A push arrived (the other party's message, or this tab's
        // own just-sent message echoing back). Re-sync silently
        // rather than hand-splicing the payload into local state --
        // loadThread() is the single source of truth for
        // ordering/is_read/dedup, so this stays one code path instead
        // of two that could quietly diverge.
        loadThread({ silent: true })
      },
      onTyping: (payload) => {
        setIsOtherTyping(payload.is_typing)
        if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current)
        if (payload.is_typing) {
          typingClearTimerRef.current = window.setTimeout(
            () => setIsOtherTyping(false),
            TYPING_INDICATOR_TIMEOUT_MS
          )
        }
      },
    })
    socketRef.current = socket

    return () => {
      isMounted = false
      // Same StrictMode double-invoke fix as useConversations.js — see
      // that file's cleanup comment for the full mechanics. Without
      // this reset, opening a thread in dev mode can strand isLoading
      // at `true` forever (the composer/thread would never leave its
      // loading state even though messages did load internally).
      isFetchingRef.current = false
      refreshThreadRef.current = null
      window.clearInterval(intervalId)
      socket.close()
      socketRef.current = null
      if (typingClearTimerRef.current) window.clearTimeout(typingClearTimerRef.current)
      setIsOtherTyping(false)
      setConnectionStatus('connecting')
    }
  }, [providerId, otherUserId, withUserId])

  const notifyTyping = useCallback((isTyping) => {
    socketRef.current?.sendTyping(isTyping)
  }, [])

  const releaseLocalUrl = useCallback((url) => {
    if (!url) return
    URL.revokeObjectURL(url)
    localUrlsRef.current.delete(url)
  }, [])

  const send = useCallback(
    async (input) => {
      const payload = typeof input === 'string' ? { content: input } : input || {}
      const trimmed = (payload.content ?? '').trim()
      const attachment = payload.attachment ?? null
      if (!providerId || (!trimmed && !attachment)) return

      const messageType = attachment
        ? payload.messageType || classifyFile(attachment)
        : MESSAGE_TYPE.TEXT
      const durationSeconds = payload.durationSeconds ?? null

      notifyTyping(false)
      setIsSending(true)
      setSendError(null)

      // Optimistic bubble: appears immediately instead of waiting on
      // the round trip -- the single biggest perceived-speed fix for
      // a chat that otherwise feels laggy. `sender_id: null` can never
      // equal a real otherUserId, so MessageThread's `isMine` check
      // (message.sender_id !== otherUserId) renders it on the right
      // side right away, with no dependency on knowing our own real
      // user id (AuthContext only stores { role, name } today).
      const tempId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      let localUrl = null
      if (attachment && messageType !== MESSAGE_TYPE.FILE) {
        localUrl = URL.createObjectURL(attachment)
        localUrlsRef.current.add(localUrl)
      }

      const optimistic = {
        id: tempId,
        sender_id: null,
        content: trimmed,
        created_at: new Date().toISOString(),
        is_read: false,
        message_type: messageType,
        _pending: true,
      }
      if (attachment) {
        optimistic.attachment_name = attachment.name
        optimistic.attachment_size = attachment.size
        optimistic.attachment_mime = attachment.type
        optimistic.duration_seconds = durationSeconds
        optimistic._localUrl = localUrl
        optimistic._progress = 0
        // Everything needed to try again without asking the person to
        // pick the file / re-record the voice note.
        optimistic._retryPayload = { content: trimmed, attachment, messageType, durationSeconds }
      }
      setMessages((current) => [...current, optimistic])

      if (attachment) uploadsInFlightRef.current += 1

      try {
        const request = { providerId, withUserId, content: trimmed }
        if (attachment) {
          request.attachment = attachment
          request.messageType = messageType
          if (durationSeconds != null) request.durationSeconds = durationSeconds
          let lastPercent = -1
          request.onUploadProgress = (fraction) => {
            const percent = Math.round(fraction * 100)
            if (percent === lastPercent) return
            lastPercent = percent
            setMessages((current) =>
              current.map((message) => (message.id === tempId ? { ...message, _progress: fraction } : message))
            )
          }
        }

        const created = await sendMessage(request)
        // The conversation list's "last message" line uses the short
        // label for attachments ("📷 Photo") rather than empty text.
        onMessageSentRef.current?.(otherUserId, {
          content: created.preview ?? created.content,
          created_at: created.created_at,
        })

        // Reconcile with the real id/timestamp the instant the POST
        // succeeds, rather than waiting on the next sync -- flips the
        // bubble's clock icon to a checkmark immediately. If the
        // socket's own echo of this message arrives and triggers a
        // loadThread() first, that server-side list already contains
        // this same message for real, so the tempId placeholder is
        // simply absent from it -- no duplicate either way.
        setMessages((current) => {
          // A re-sync can already have delivered the real message.
          if (current.some((message) => message.id === created.id)) {
            return current.filter((message) => message.id !== tempId)
          }
          return current.map((message) => {
            if (message.id !== tempId) return message
            const {
              _localUrl: previousLocalUrl, // eslint-disable-line no-unused-vars
              _progress, // eslint-disable-line no-unused-vars
              _retryPayload, // eslint-disable-line no-unused-vars
              ...rest
            } = message
            return {
              ...rest,
              id: created.id,
              created_at: created.created_at,
              attachment_url: created.attachment_url ?? null,
              attachment_name: created.attachment_name ?? rest.attachment_name,
              attachment_size: created.attachment_size ?? rest.attachment_size,
              attachment_mime: created.attachment_mime ?? rest.attachment_mime,
              duration_seconds: created.duration_seconds ?? rest.duration_seconds,
              _pending: false,
            }
          })
        })
        // The bubble now points at the server URL; free the local copy.
        releaseLocalUrl(localUrl)
      } catch (err) {
        setSendError(err.message || 'Could not send your message. Please try again.')
        setMessages((current) =>
          current.map((message) =>
            message.id === tempId ? { ...message, _pending: false, _failed: true } : message
          )
        )
      } finally {
        setIsSending(false)
        if (attachment) {
          uploadsInFlightRef.current = Math.max(0, uploadsInFlightRef.current - 1)
          if (uploadsInFlightRef.current === 0 && resyncAfterUploadRef.current) {
            resyncAfterUploadRef.current = false
            refreshThreadRef.current?.()
          }
        }
      }
    },
    [providerId, withUserId, otherUserId, notifyTyping, releaseLocalUrl]
  )

  // Lets a failed bubble be tapped to resend without retyping it (or
  // re-picking the file / re-recording the voice note) -- drops the
  // failed placeholder and re-runs send() with what it was built from.
  const retryFailedMessage = useCallback(
    (failedMessage) => {
      setMessages((current) => current.filter((message) => message.id !== failedMessage.id))
      releaseLocalUrl(failedMessage._localUrl)
      send(failedMessage._retryPayload ?? failedMessage.content)
    },
    [send, releaseLocalUrl]
  )

  return {
    messages: providerId ? messages : [],
    isLoading,
    error: providerId ? error : null,
    send,
    isSending,
    sendError,
    connectionStatus,
    isOtherTyping,
    notifyTyping,
    retryFailedMessage,
  }
}

export default useChatThread