import { useCallback, useEffect, useRef, useState } from 'react'

import { MAX_VOICE_SECONDS, MIN_VOICE_SECONDS } from '@/lib/chatAttachments'

// Preference order: Chrome/Edge/Firefox -> webm/ogg, Safari -> mp4.
const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mpeg']

function pickSupportedMimeType() {
  if (typeof window.MediaRecorder?.isTypeSupported !== 'function') return ''
  return MIME_CANDIDATES.find((type) => window.MediaRecorder.isTypeSupported(type)) || ''
}

function extensionFor(mimeType) {
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('mpeg')) return 'mp3'
  return 'webm'
}

function describeMicError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Microphone access was blocked. Allow it in your browser settings and try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No microphone was found on this device.'
    case 'NotReadableError':
      return 'Your microphone is being used by another app.'
    default:
      return 'Could not start recording. Please try again.'
  }
}

export function isVoiceRecordingSupported() {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined'
  )
}

/**
 * Records a voice note with the browser's MediaRecorder.
 *
 *   const recorder = useVoiceRecorder({
 *     onFinish: ({ file, durationSeconds }) => ...,  // called after stop()
 *     onError: (message) => ...,
 *   })
 *   recorder.start()   // asks for the mic, begins recording
 *   recorder.stop()    // finishes and delivers the file to onFinish
 *   recorder.cancel()  // throws the recording away
 *
 * `status`: 'idle' | 'requesting' (permission prompt) | 'recording'.
 * Recording stops by itself at MAX_VOICE_SECONDS and still delivers.
 * Everything (mic stream, timer) is released on unmount, so the browser's
 * "recording" indicator can never get stuck on.
 */
export function useVoiceRecorder({ onFinish, onError } = {}) {
  const [status, setStatus] = useState('idle')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const startedAtRef = useRef(0)
  const shouldDeliverRef = useRef(true)
  const isStartingRef = useRef(false)

  // Latest callbacks without re-creating start/stop on every render.
  const onFinishRef = useRef(onFinish)
  const onErrorRef = useRef(onError)
  useEffect(() => {
    onFinishRef.current = onFinish
    onErrorRef.current = onError
  })

  const releaseResources = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    recorderRef.current = null
  }, [])

  const stop = useCallback(() => {
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const cancel = useCallback(() => {
    shouldDeliverRef.current = false
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    } else {
      releaseResources()
      setStatus('idle')
      setElapsedSeconds(0)
    }
  }, [releaseResources])

  const start = useCallback(async () => {
    if (isStartingRef.current || recorderRef.current) return
    if (!isVoiceRecordingSupported()) {
      onErrorRef.current?.("Voice messages aren't supported in this browser.")
      return
    }

    isStartingRef.current = true
    setStatus('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const mimeType = pickSupportedMimeType()
      const recorder = mimeType ? new window.MediaRecorder(stream, { mimeType }) : new window.MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      shouldDeliverRef.current = true

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onerror = () => {
        shouldDeliverRef.current = false
        releaseResources()
        setStatus('idle')
        setElapsedSeconds(0)
        onErrorRef.current?.('Recording failed. Please try again.')
      }

      recorder.onstop = () => {
        const durationSeconds = Math.min(
          MAX_VOICE_SECONDS,
          Math.round((Date.now() - startedAtRef.current) / 1000)
        )
        const actualType = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0]
        const chunks = chunksRef.current
        const shouldDeliver = shouldDeliverRef.current

        releaseResources()
        chunksRef.current = []
        setStatus('idle')
        setElapsedSeconds(0)

        if (!shouldDeliver || chunks.length === 0) return

        if (durationSeconds < MIN_VOICE_SECONDS) {
          onErrorRef.current?.('Recording was too short. Hold on a little longer.')
          return
        }

        const blob = new Blob(chunks, { type: actualType })
        const file = new File([blob], `voice-message-${Date.now()}.${extensionFor(actualType)}`, {
          type: actualType,
        })
        onFinishRef.current?.({ file, durationSeconds })
      }

      startedAtRef.current = Date.now()
      // A timeslice makes the browser hand us data regularly instead of
      // one giant chunk at the very end.
      recorder.start(1000)
      setStatus('recording')
      setElapsedSeconds(0)

      timerRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
        setElapsedSeconds(elapsed)
        if (elapsed >= MAX_VOICE_SECONDS) stop()
      }, 250)
    } catch (error) {
      releaseResources()
      setStatus('idle')
      onErrorRef.current?.(describeMicError(error))
    } finally {
      isStartingRef.current = false
    }
  }, [releaseResources, stop])

  // Unmount (e.g. switching conversations mid-recording): discard quietly.
  useEffect(
    () => () => {
      shouldDeliverRef.current = false
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null
        recorder.onerror = null
        recorder.stop()
      }
      releaseResources()
    },
    [releaseResources]
  )

  return {
    status,
    isRecording: status === 'recording',
    isRequesting: status === 'requesting',
    elapsedSeconds,
    start,
    stop,
    cancel,
  }
}

export default useVoiceRecorder