/**
 * Shared rules + small formatters for chat attachments (photos, files,
 * voice notes). The limits below MUST match the backend's
 * backend/contacts/validators.py -- the server is the real gatekeeper,
 * this copy only exists so people get a friendly error instantly
 * instead of after waiting for a big upload to fail.
 */

const MB = 1024 * 1024

export const MAX_IMAGE_BYTES = 10 * MB
export const MAX_VOICE_BYTES = 10 * MB
export const MAX_FILE_BYTES = 15 * MB
export const MAX_VOICE_SECONDS = 300 // 5 minutes
export const MIN_VOICE_SECONDS = 1 // shorter than this = accidental tap

export const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']
export const DOCUMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'rtf',
  'odt',
  'ods',
  'odp',
  'zip',
]

// Listing exact image types (not "image/*") also makes iPhones convert
// HEIC photos to JPEG automatically on upload.
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'
export const FILE_ACCEPT = DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(',')

export const MESSAGE_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  VOICE: 'voice',
}

export function getExtension(filename = '') {
  const dotIndex = filename.lastIndexOf('.')
  return dotIndex === -1 ? '' : filename.slice(dotIndex + 1).toLowerCase()
}

/** 'image' for supported photo formats, otherwise 'file'. */
export function classifyFile(file) {
  return IMAGE_EXTENSIONS.includes(getExtension(file?.name)) ? MESSAGE_TYPE.IMAGE : MESSAGE_TYPE.FILE
}

/** Returns an error message, or null when the file is OK to send. */
export function validateAttachment(file, type = classifyFile(file)) {
  if (!file) return 'No file selected.'
  if (file.size === 0) return 'That file is empty.'

  const extension = getExtension(file.name)

  if (type === MESSAGE_TYPE.IMAGE) {
    if (!IMAGE_EXTENSIONS.includes(extension)) return 'Only JPG, PNG, GIF or WEBP photos can be sent.'
    if (file.size > MAX_IMAGE_BYTES) return `Photos must be ${MAX_IMAGE_BYTES / MB}MB or smaller.`
    return null
  }

  if (!DOCUMENT_EXTENSIONS.includes(extension)) {
    return "This file type isn't supported. You can send PDF, Word, Excel, PowerPoint, TXT, CSV, RTF, OpenDocument and ZIP files."
  }
  if (file.size > MAX_FILE_BYTES) return `Files must be ${MAX_FILE_BYTES / MB}MB or smaller.`
  return null
}

export function formatFileSize(bytes) {
  if (!bytes || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / MB).toFixed(1)} MB`
}

/** 75 -> "1:15" */
export function formatDuration(totalSeconds) {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0
  const minutes = Math.floor(safe / 60)
  const seconds = safe % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

/** True on phones/tablets, where the camera is best opened via the native camera app. */
export function isTouchDevice() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
}