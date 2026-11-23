import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const MAX_CAPTURE_DIMENSION_PX = 1920
const JPEG_QUALITY = 0.9

function isCameraSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

function describeCameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Camera access was blocked. Allow it in your browser settings and try again.'
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'No camera was found on this device.'
    case 'NotReadableError':
      return 'Your camera is being used by another app.'
    default:
      return 'Could not open the camera. Please try again.'
  }
}

/**
 * The live camera + capture flow. Mounted only while the dialog is
 * open, so every piece of state here (and the camera stream itself)
 * starts fresh each time and is released the moment the dialog closes.
 */
function CameraStage({ onCapture, onClose, onFallback }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  const supported = isCameraSupported()
  const [status, setStatus] = useState(supported ? 'starting' : 'error') // 'starting' | 'live' | 'captured' | 'error'
  const [errorMessage, setErrorMessage] = useState(
    supported ? '' : "Your browser can't open the camera here. Camera access needs a secure (https) connection."
  )
  const [facingMode, setFacingMode] = useState('environment')
  const [canSwitchCamera, setCanSwitchCamera] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [captured, setCaptured] = useState(null) // { file, url }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  // (Re)start the camera whenever the lens changes or "Retake" is pressed.
  useEffect(() => {
    if (!isCameraSupported()) return undefined
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('live')

        const devices = await navigator.mediaDevices.enumerateDevices()
        if (!cancelled) setCanSwitchCamera(devices.filter((device) => device.kind === 'videoinput').length > 1)
      } catch (error) {
        if (!cancelled) {
          setStatus('error')
          setErrorMessage(describeCameraError(error))
        }
      }
    }

    startCamera()

    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [facingMode, attempt])

  // Release the captured photo's preview URL when replaced / closed.
  useEffect(() => {
    if (!captured) return undefined
    const { url } = captured
    return () => URL.revokeObjectURL(url)
  }, [captured])

  function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth) return

    const scale = Math.min(1, MAX_CAPTURE_DIMENSION_PX / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStatus('error')
          setErrorMessage('Could not capture the photo. Please try again.')
          return
        }
        const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
        stopStream()
        setCaptured({ file, url: URL.createObjectURL(blob) })
        setStatus('captured')
      },
      'image/jpeg',
      JPEG_QUALITY
    )
  }

  function handleRetake() {
    setCaptured(null)
    setStatus('starting')
    setAttempt((count) => count + 1)
  }

  function handleSwitchCamera() {
    setStatus('starting')
    setFacingMode((mode) => (mode === 'environment' ? 'user' : 'environment'))
  }

  function handleUsePhoto() {
    if (!captured) return
    onCapture(captured.file)
    onClose()
  }

  if (status === 'error') {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <Camera className="h-8 w-8 text-[var(--color-text-subtle)]" aria-hidden="true" />
        <p role="alert" className="text-sm text-[var(--color-text-muted)]">
          {errorMessage}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onClose()
              onFallback?.()
            }}
          >
            Choose from device
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[var(--radius-input)] bg-black">
        {status === 'captured' && captured ? (
          <img src={captured.url} alt="Captured photo" className="h-full w-full object-cover" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn('h-full w-full object-cover', facingMode === 'user' && '-scale-x-100')}
          />
        )}
        {status === 'starting' ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
            <Spinner className="h-6 w-6" />
          </div>
        ) : null}
      </div>

      {status === 'captured' ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={handleRetake}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Retake
          </Button>
          <Button className="flex-1" onClick={handleUsePhoto}>
            Use photo
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-4">
          <Button onClick={handleCapture} disabled={status !== 'live'} className="min-w-40">
            <Camera className="h-4 w-4" aria-hidden="true" /> Capture
          </Button>
          {canSwitchCamera ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwitchCamera}
              disabled={status !== 'live'}
              aria-label="Switch camera"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

/**
 * In-app camera for desktop browsers (phones use the native camera app
 * instead — see MessageComposer). `onFallback` is called if the camera
 * can't be opened and the person chooses to pick a photo from their
 * device instead.
 */
function CameraCaptureDialog({ open, onClose, onCapture, onFallback }) {
  return (
    <Dialog open={open} onClose={onClose} title="Take a photo" className="max-w-lg">
      <CameraStage onCapture={onCapture} onClose={onClose} onFallback={onFallback} />
    </Dialog>
  )
}

export { CameraCaptureDialog }