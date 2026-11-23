import { FileText, X } from 'lucide-react'

import { formatFileSize } from '@/lib/chatAttachments'

/**
 * The strip shown above the message box once someone has picked a photo
 * or file but not yet sent it. Lets them double-check it, type an
 * optional caption in the normal message box, or remove it.
 *
 *   attachment: { file: File, type: 'image' | 'file', previewUrl: string | null }
 */
function AttachmentPreview({ attachment, onRemove }) {
  const { file, type, previewUrl } = attachment

  return (
    <div className="mx-3 mt-3 flex items-center gap-3 rounded-[var(--radius-input)] border border-[var(--color-border)] bg-[var(--color-bg)] p-2.5">
      {type === 'image' && previewUrl ? (
        <img src={previewUrl} alt="Selected photo preview" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
      ) : (
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-tint)]">
          <FileText className="h-6 w-6 text-[var(--color-primary-hover)]" aria-hidden="true" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-[var(--color-text)]">{file.name}</p>
        <p className="text-xs text-[var(--color-text-subtle)]">{formatFileSize(file.size)}</p>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-white hover:text-[var(--color-text)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}

export { AttachmentPreview }