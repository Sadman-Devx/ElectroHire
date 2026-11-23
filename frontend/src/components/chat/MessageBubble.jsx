import { useState } from 'react'
import { Check, CheckCheck, Clock, FileText, RotateCcw } from 'lucide-react'

import { formatFileSize } from '@/lib/chatAttachments'
import { formatMessageTime } from '@/lib/formatChatTime'
import { cn } from '@/lib/utils'

import { ImageLightbox } from './ImageLightbox'
import { VoiceMessagePlayer } from './VoiceMessagePlayer'

/**
 * Day 7 spec: "Message Bubbles (Sent/Received, Timestamp)".
 *
 * `isMine` is passed in rather than computed here — MessageThread
 * derives it by comparing `message.sender_id !== otherUserId`, which
 * works identically against the real API's MessageListItemSerializer
 * shape (id, sender_id, sender_name, content, created_at, is_read),
 * with no dependency on knowing "my own" user id — useful since
 * AuthContext only stores { role, name } today (see
 * services/tokenStorage.js), not a user id. It's also what makes an
 * optimistic `sender_id: null` placeholder (useChatThread.js's send())
 * render on the right side immediately, before the real id exists.
 *
 * Real-time chat pass: a bubble can now be `_pending` (sent locally,
 * POST still in flight — clock icon) or `_failed` (POST rejected —
 * tap to retry via `onRetry`). Neither status exists once a message
 * has round-tripped through the server, so this only ever applies to
 * `isMine` bubbles.
 *
 * Attachments update: the bubble body depends on `message.message_type`:
 *   'text'  -> the text (default; also used when the field is missing,
 *              so older API responses keep rendering)
 *   'image' -> a tappable photo (opens ImageLightbox) + optional caption
 *   'file'  -> a download card (icon, name, size) + optional caption
 *   'voice' -> VoiceMessagePlayer
 * While an attachment is uploading, `_localUrl` shows the file
 * instantly and `_progress` (0..1) drives a small progress ring.
 */
function UploadProgress({ fraction }) {
  const percent = Math.round((fraction ?? 0) * 100)
  return (
    <div
      className="absolute inset-0 flex items-center justify-center rounded-[calc(var(--radius-input)-4px)] bg-black/35"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label="Uploading"
    >
      <span className="rounded-full bg-black/50 px-2 py-1 text-xs font-semibold text-white">{percent}%</span>
    </div>
  )
}

function ImageBody({ message, isMine, isBusy }) {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const src = message._localUrl || message.attachment_url
  const alt = message.content || message.attachment_name || 'Photo'

  if (!src) return null

  return (
    <>
      <div className="relative">
        {isBusy ? (
          <img src={src} alt={alt} className="max-h-72 w-full rounded-[calc(var(--radius-input)-4px)] object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            aria-label="Open photo"
            className="block w-full cursor-zoom-in"
          >
            <img
              src={src}
              alt={alt}
              loading="lazy"
              className="max-h-72 w-full rounded-[calc(var(--radius-input)-4px)] object-cover"
            />
          </button>
        )}
        {message._pending ? <UploadProgress fraction={message._progress} /> : null}
      </div>
      {message.content ? (
        <p
          className={cn(
            'whitespace-pre-wrap break-words px-1 pt-2 text-sm',
            isMine ? 'text-white' : 'text-[var(--color-text)]'
          )}
        >
          {message.content}
        </p>
      ) : null}
      {isLightboxOpen ? <ImageLightbox src={src} alt={alt} onClose={() => setIsLightboxOpen(false)} /> : null}
    </>
  )
}

function FileBody({ message, isMine, isBusy }) {
  const url = message.attachment_url
  const card = (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
          isMine ? 'bg-white/25' : 'bg-[var(--color-primary-tint)]'
        )}
      >
        <FileText
          className={cn('h-5 w-5', isMine ? 'text-white' : 'text-[var(--color-primary-hover)]')}
          aria-hidden="true"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{message.attachment_name || 'File'}</p>
        <p className={cn('text-xs', isMine ? 'text-white/80' : 'text-[var(--color-text-subtle)]')}>
          {message._pending ? `Uploading… ${Math.round((message._progress ?? 0) * 100)}%` : formatFileSize(message.attachment_size)}
        </p>
      </div>
    </div>
  )

  return (
    <>
      {url && !isBusy ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          download={message.attachment_name || undefined}
          aria-label={`Open file ${message.attachment_name || ''}`.trim()}
          className="block w-56 max-w-full sm:w-64"
        >
          {card}
        </a>
      ) : (
        <div className="w-56 max-w-full sm:w-64">{card}</div>
      )}
      {message.content ? (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{message.content}</p>
      ) : null}
    </>
  )
}

function MessageBubble({ message, isMine, onRetry }) {
  const isPending = isMine && message._pending
  const isFailed = isMine && message._failed
  const isBusy = isPending || isFailed
  const type = message.message_type || 'text'
  const isImage = type === 'image'

  return (
    <div className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
      <div
        className={cn(
          'flex',
          isMine ? 'justify-end' : 'justify-start',
          isFailed && 'cursor-pointer'
        )}
        role={isFailed ? 'button' : undefined}
        tabIndex={isFailed ? 0 : undefined}
        onClick={isFailed ? () => onRetry?.(message) : undefined}
        onKeyDown={
          isFailed
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') onRetry?.(message)
              }
            : undefined
        }
      >
        <div
          className={cn(
            'max-w-[75%] rounded-[var(--radius-input)] sm:max-w-[65%]',
            isImage ? 'p-1.5' : 'px-3.5 py-2.5',
            isMine
              ? 'rounded-br-sm bg-[var(--color-primary)] text-white'
              : 'rounded-bl-sm bg-[var(--color-bg)] text-[var(--color-text)]',
            isPending && 'opacity-70',
            isFailed && 'bg-[var(--color-danger)] opacity-90'
          )}
        >
          {type === 'image' ? (
            <ImageBody message={message} isMine={isMine} isBusy={isBusy} />
          ) : type === 'file' ? (
            <FileBody message={message} isMine={isMine} isBusy={isBusy} />
          ) : type === 'voice' ? (
            <VoiceMessagePlayer
              src={message._localUrl || message.attachment_url}
              durationSeconds={message.duration_seconds}
              isMine={isMine}
              disabled={isBusy}
            />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
          )}
          <div
            className={cn(
              'mt-1 flex items-center justify-end gap-1 text-[11px]',
              isImage && 'px-1',
              isMine ? 'text-white/80' : 'text-[var(--color-text-subtle)]'
            )}
          >
            <span>{formatMessageTime(message.created_at)}</span>
            {isMine ? (
              isFailed ? (
                <RotateCcw className="h-3.5 w-3.5" aria-label="Failed to send — tap to retry" />
              ) : isPending ? (
                <Clock className="h-3.5 w-3.5" aria-label="Sending" />
              ) : message.is_read ? (
                <CheckCheck className="h-3.5 w-3.5" aria-label="Read" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-label="Sent" />
              )
            ) : null}
          </div>
        </div>
      </div>
      {isFailed ? (
        <p className="mt-0.5 text-[11px] font-medium text-[var(--color-danger)]">
          Failed to send · Tap to retry
        </p>
      ) : null}
    </div>
  )
}

export { MessageBubble }