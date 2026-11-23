import { useEffect } from 'react'
import { Download, X } from 'lucide-react'

/**
 * Full-screen photo viewer opened by tapping a photo in a chat bubble.
 * Closes on Escape, on a click outside the photo, or via the close
 * button. Framework-free for the same reason ui/dialog.jsx is (no
 * headless-UI package is installed).
 */
function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Photo preview"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="absolute right-4 top-4 flex items-center gap-2">
        <a
          href={src}
          download
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open original photo"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        >
          <Download className="h-5 w-5" aria-hidden="true" />
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <img src={src} alt={alt} className="max-h-full max-w-full rounded-lg object-contain" />
    </div>
  )
}

export { ImageLightbox }