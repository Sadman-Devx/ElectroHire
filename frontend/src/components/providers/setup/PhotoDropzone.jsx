import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp'

/**
 * Circular profile-photo picker — Day 5 spec: "Photo Upload (Drag or
 * Click)". Controlled component: the selected File (or null) lives in
 * the parent form's state, this component only turns
 * drag/drop/click/keyboard interactions into `onChange(file)` calls
 * and renders a live preview.
 */
function PhotoDropzone({ file, onChange, error, disabled = false }) {
  const inputRef = useRef(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)

  // Object URL is derived straight from `file` during render (pure,
  // deterministic), so there's no separate piece of state to keep in
  // sync. The effect below exists purely to release the *previous*
  // URL once React has committed a new one (and on unmount).
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function openFileDialog() {
    if (disabled) return
    inputRef.current?.click()
  }

  function handleFileInputChange(event) {
    const nextFile = event.target.files?.[0] ?? null
    onChange(nextFile)
    // Reset the input value so re-selecting the exact same file
    // (e.g. after removing it) still fires a change event.
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setIsDraggingOver(false)
    if (disabled) return
    const droppedFile = event.dataTransfer.files?.[0]
    if (droppedFile) onChange(droppedFile)
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openFileDialog()
    }
  }

  function handleRemove(event) {
    event.stopPropagation()
    onChange(null)
  }

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-label={file ? 'Drag and drop to change profile photo' : 'Drag and drop to add profile photo'}
          aria-describedby={error ? 'photo-upload-error' : undefined}
          onClick={openFileDialog}
          onKeyDown={handleKeyDown}
          onDragOver={(event) => {
            event.preventDefault()
            if (!disabled) setIsDraggingOver(true)
          }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
          className={cn(
            'flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]',
            disabled && 'cursor-not-allowed opacity-60',
            error
              ? 'border-[var(--color-danger)] bg-[var(--color-danger-tint)]'
              : isDraggingOver
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-tint)]'
                : 'border-[var(--color-primary)]/50 bg-[var(--color-primary-tint)] hover:border-[var(--color-primary)]'
          )}
        >
          {previewUrl ? (
            <img src={previewUrl} alt="Selected profile" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-7 w-7 text-[var(--color-primary-hover)]" aria-hidden="true" />
          )}
        </div>

        {file ? (
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove selected photo"
            className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-danger)] text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          aria-label="Upload profile photo"
          onChange={handleFileInputChange}
          disabled={disabled}
          className="sr-only"
          tabIndex={-1}
        />
      </div>

      <div>
        <p className="text-sm font-medium text-[var(--color-text)]">Profile photo</p>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Drag a photo onto the circle, or click to choose one. JPG, PNG, or WEBP, up to 5MB.
        </p>
        <button
          type="button"
          onClick={openFileDialog}
          disabled={disabled}
          className="mt-2 rounded-[var(--radius-button)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {file ? 'Choose a different photo' : 'Choose photo'}
        </button>
        {file ? (
          <p className="mt-1.5 max-w-[220px] truncate text-xs text-[var(--color-text-subtle)]" title={file.name}>
            {file.name}
          </p>
        ) : null}
        {error ? (
          <p id="photo-upload-error" className="mt-1.5 text-xs font-medium text-[var(--color-danger)]">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { PhotoDropzone }