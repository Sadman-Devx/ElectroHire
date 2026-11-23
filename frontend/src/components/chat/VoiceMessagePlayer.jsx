import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'

import { formatDuration } from '@/lib/chatAttachments'
import { cn } from '@/lib/utils'

// Only one voice note plays at a time: starting another pauses this one.
let activeAudio = null

/**
 * Small voice-note player for a chat bubble.
 *
 * `durationSeconds` comes from the server (the recorder measured it).
 * It is preferred over the <audio> element's own duration, because
 * browsers often report `Infinity` for recorded .webm files until they
 * have been fully played once.
 */
function VoiceMessagePlayer({ src, durationSeconds, isMine, disabled }) {
  const audioRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [metadataDuration, setMetadataDuration] = useState(0)
  const [hasError, setHasError] = useState(false)

  const total = durationSeconds || metadataDuration || 0
  const progress = total > 0 ? Math.min(1, currentTime / total) : 0

  // Stop playback if the bubble disappears while playing.
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      if (audio) audio.pause()
      if (activeAudio === audio) activeAudio = null
    }
  }, [])

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio || disabled) return

    if (isPlaying) {
      audio.pause()
      return
    }

    if (activeAudio && activeAudio !== audio) activeAudio.pause()
    activeAudio = audio
    try {
      await audio.play()
      setHasError(false)
    } catch {
      setHasError(true)
    }
  }

  function handleSeek(event) {
    const audio = audioRef.current
    if (!audio || total <= 0) return
    const nextTime = (Number(event.target.value) / 100) * total
    audio.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const shownTime = isPlaying || currentTime > 0 ? currentTime : total

  return (
    <div className="flex w-56 max-w-full items-center gap-2.5 sm:w-64">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false)
          setCurrentTime(0)
        }}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value)) setMetadataDuration(value)
        }}
        onError={() => setHasError(true)}
      />

      <button
        type="button"
        onClick={togglePlay}
        disabled={disabled}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-60',
          isMine
            ? 'bg-white/25 text-white hover:bg-white/35'
            : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]'
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4 translate-x-px" aria-hidden="true" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(progress * 100)}
          onChange={handleSeek}
          disabled={disabled || total <= 0}
          aria-label="Seek voice message"
          className={cn('h-1 w-full cursor-pointer', isMine ? 'accent-white' : 'accent-[var(--color-primary)]')}
        />
        <p className={cn('mt-0.5 text-[11px]', isMine ? 'text-white/80' : 'text-[var(--color-text-subtle)]')}>
          {hasError ? "Can't play this voice message" : formatDuration(shownTime)}
        </p>
      </div>
    </div>
  )
}

export { VoiceMessagePlayer }