import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, Mic, Paperclip, Plus, Send, ThumbsUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder'
import {
  classifyFile,
  FILE_ACCEPT,
  IMAGE_ACCEPT,
  isTouchDevice,
  MESSAGE_TYPE,
  validateAttachment,
} from '@/lib/chatAttachments'

import { AttachmentPreview } from './AttachmentPreview'
import { CameraCaptureDialog } from './CameraCaptureDialog'
import { VoiceRecorderBar } from './VoiceRecorderBar'

// How long to wait after the last keystroke before telling the other
// party "stopped typing" — long enough to survive normal pauses
// between words, short enough that the indicator doesn't linger after
// someone's actually walked away from the keyboard.
const TYPING_STOP_DELAY_MS = 1500

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2 rounded-[calc(var(--radius-input)-4px)] px-3 py-2 text-left text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-bg)]'

const TOOL_BUTTON_CLASS =
  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-primary-hover)] transition-colors hover:bg-[var(--color-primary-tint)] disabled:pointer-events-none disabled:opacity-50'

/**
 * Day 7 spec: "Message Input + Send Button", extended with a live
 * typing signal (real-time chat pass): `onTypingChange(isTyping)` — if
 * provided — fires `true` on the first keystroke of a fresh draft and
 * `false` either on submit or after a pause with no further typing.
 * Deliberately not fired on every keystroke: that would flood the
 * WebSocket with one "typing" frame per character for no UI benefit,
 * since the other party's indicator is just a boolean.
 *
 * Attachments update (same layout idea as a mobile messenger):
 *   [ camera ] [ photos ] [ file ] [ mic ]  [ message box ]  [ send / 👍 ]
 * - Camera:  phones/tablets open the native camera app (best quality);
 *            desktop opens the in-app camera dialog.
 * - Photos / File: native pickers. Photos can also be pasted (Ctrl+V).
 * - Mic:     records a voice note; the send button inside the
 *            recording bar sends it straight away.
 * - A picked photo/file is shown in a preview strip first; whatever is
 *   typed in the message box becomes its caption.
 * On very narrow screens the three pickers collapse into one "+" menu.
 *
 * `onSend` is called with a plain string for text (unchanged), or with
 * `{ content, attachment, messageType, durationSeconds? }` for anything
 * with a file — see useChatThread's send().
 */
function MessageComposer({ onSend, isSending, isDisabled, onTypingChange }) {
  const [draft, setDraft] = useState('')
  const [attachment, setAttachment] = useState(null) // { file, type, previewUrl }
  const [localError, setLocalError] = useState(null)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const isTypingRef = useRef(false)
  const stopTypingTimerRef = useRef(null)
  const photoInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const fileInputRef = useRef(null)
  const menuRef = useRef(null)

  const recorder = useVoiceRecorder({
    onFinish: ({ file, durationSeconds }) => {
      setLocalError(null)
      onSend({ attachment: file, messageType: MESSAGE_TYPE.VOICE, durationSeconds })
    },
    onError: setLocalError,
  })

  function clearStopTypingTimer() {
    if (stopTypingTimerRef.current) {
      window.clearTimeout(stopTypingTimerRef.current)
      stopTypingTimerRef.current = null
    }
  }

  function handleChange(event) {
    const value = event.target.value
    setDraft(value)

    if (!onTypingChange) return

    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true
        onTypingChange(true)
      }
      clearStopTypingTimer()
      stopTypingTimerRef.current = window.setTimeout(() => {
        isTypingRef.current = false
        onTypingChange(false)
      }, TYPING_STOP_DELAY_MS)
    } else if (isTypingRef.current) {
      // Cleared the input entirely (select-all + delete, etc) — no
      // need to wait out the timer to say "stopped typing".
      clearStopTypingTimer()
      isTypingRef.current = false
      onTypingChange(false)
    }
  }

  function stageFile(file) {
    if (!file) return
    const type = classifyFile(file)
    const problem = validateAttachment(file, type)
    if (problem) {
      setLocalError(problem)
      return
    }
    setLocalError(null)
    setAttachment({
      file,
      type,
      previewUrl: type === MESSAGE_TYPE.IMAGE ? URL.createObjectURL(file) : null,
    })
  }

  function handleFileInputChange(event) {
    stageFile(event.target.files?.[0])
    // Reset so picking the same file twice in a row still fires onChange.
    event.target.value = ''
  }

  function handlePaste(event) {
    const pastedImage = Array.from(event.clipboardData?.files ?? []).find((file) =>
      file.type.startsWith('image/')
    )
    if (pastedImage) {
      event.preventDefault()
      stageFile(pastedImage)
    }
  }

  function handleCameraClick() {
    setIsMenuOpen(false)
    if (isTouchDevice()) {
      cameraInputRef.current?.click()
    } else {
      setIsCameraOpen(true)
    }
  }

  function openPhotoPicker() {
    setIsMenuOpen(false)
    photoInputRef.current?.click()
  }

  function openFileInputPicker() {
    setIsMenuOpen(false)
    fileInputRef.current?.click()
  }

  function handleSubmit(event) {
    event.preventDefault()
    const trimmed = draft.trim()
    if ((!trimmed && !attachment) || isSending) return
    clearStopTypingTimer()
    isTypingRef.current = false
    // useChatThread's send() already signals "stopped typing" itself
    // (see its notifyTyping(false) call) — not duplicated here, this
    // just stops this component's own local timer from firing later.
    if (attachment) {
      onSend({ content: trimmed, attachment: attachment.file, messageType: attachment.type })
    } else {
      onSend(trimmed)
    }
    setDraft('')
    setAttachment(null)
    setLocalError(null)
  }

  useEffect(() => clearStopTypingTimer, [])

  // Free the preview image's blob URL when it's removed, replaced,
  // sent, or this component goes away.
  useEffect(() => {
    const previewUrl = attachment?.previewUrl
    if (!previewUrl) return undefined
    return () => URL.revokeObjectURL(previewUrl)
  }, [attachment])

  // Click-outside-to-close for the small "+" menu (same manual approach
  // as ChatWindowHeader's ReportMenu — no headless-menu library here).
  useEffect(() => {
    if (!isMenuOpen) return undefined
    function handlePointerDown(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isMenuOpen])

  const hasContent = Boolean(draft.trim()) || Boolean(attachment)
  const toolsDisabled = isDisabled || isSending

  return (
    <div className="flex-shrink-0 border-t border-[var(--color-border)]">
      {localError ? (
        <p role="alert" className="px-4 pt-2 text-xs font-medium text-[var(--color-danger)]">
          {localError}
        </p>
      ) : null}

      {attachment && !recorder.isRecording ? (
        <AttachmentPreview attachment={attachment} onRemove={() => setAttachment(null)} />
      ) : null}

      {recorder.isRecording ? (
        <VoiceRecorderBar
          elapsedSeconds={recorder.elapsedSeconds}
          onCancel={recorder.cancel}
          onFinish={recorder.stop}
        />
      ) : (
        <form onSubmit={handleSubmit} className="flex items-center gap-1.5 p-3">
          {/* Wide screens: the three pickers sit inline. */}
          <div className="hidden items-center gap-0.5 sm:flex">
            <button
              type="button"
              onClick={handleCameraClick}
              disabled={toolsDisabled}
              aria-label="Take a photo"
              title="Take a photo"
              className={TOOL_BUTTON_CLASS}
            >
              <Camera className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={openPhotoPicker}
              disabled={toolsDisabled}
              aria-label="Choose a photo"
              title="Choose a photo"
              className={TOOL_BUTTON_CLASS}
            >
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={openFileInputPicker}
              disabled={toolsDisabled}
              aria-label="Attach a file"
              title="Attach a file"
              className={TOOL_BUTTON_CLASS}
            >
              <Paperclip className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Narrow screens: one "+" button opening the same three. */}
          <div className="relative sm:hidden" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((open) => !open)}
              disabled={toolsDisabled}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              aria-label="Add attachment"
              className={TOOL_BUTTON_CLASS}
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
            </button>
            {isMenuOpen ? (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-10 mb-2 w-44 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg shadow-slate-200/70"
              >
                <button type="button" role="menuitem" onClick={handleCameraClick} className={MENU_ITEM_CLASS}>
                  <Camera className="h-4 w-4 text-[var(--color-primary-hover)]" aria-hidden="true" />
                  Camera
                </button>
                <button type="button" role="menuitem" onClick={openPhotoPicker} className={MENU_ITEM_CLASS}>
                  <ImageIcon className="h-4 w-4 text-[var(--color-primary-hover)]" aria-hidden="true" />
                  Photo
                </button>
                <button type="button" role="menuitem" onClick={openFileInputPicker} className={MENU_ITEM_CLASS}>
                  <Paperclip className="h-4 w-4 text-[var(--color-primary-hover)]" aria-hidden="true" />
                  File
                </button>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={recorder.start}
            disabled={toolsDisabled || recorder.isRequesting}
            aria-label="Record a voice message"
            title="Record a voice message"
            className={TOOL_BUTTON_CLASS}
          >
            {recorder.isRequesting ? <Spinner /> : <Mic className="h-5 w-5" aria-hidden="true" />}
          </button>

          <Input
            value={draft}
            onChange={handleChange}
            onPaste={handlePaste}
            placeholder={attachment ? 'Add a caption…' : 'Type a message…'}
            aria-label={attachment ? 'Add a caption' : 'Type a message'}
            disabled={isDisabled}
            className="min-w-0 flex-1"
          />

          {hasContent || isSending ? (
            <Button type="submit" disabled={isDisabled || isSending || !hasContent} className="flex-shrink-0">
              {isSending ? (
                <>
                  <Spinner /> Sending
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" /> Send
                </>
              )}
            </Button>
          ) : (
            <button
              type="button"
              onClick={() => onSend('👍')}
              disabled={isDisabled}
              aria-label="Quick like"
              title="Send a like"
              className={TOOL_BUTTON_CLASS}
            >
              <ThumbsUp className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </form>
      )}

      {/* Hidden native pickers, opened by the buttons above. */}
      <input
        ref={photoInputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={handleFileInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={`${FILE_ACCEPT},${IMAGE_ACCEPT}`}
        className="hidden"
        onChange={handleFileInputChange}
        tabIndex={-1}
        aria-hidden="true"
      />

      <CameraCaptureDialog
        open={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={stageFile}
        onFallback={() => cameraInputRef.current?.click()}
      />
    </div>
  )
}

export { MessageComposer }