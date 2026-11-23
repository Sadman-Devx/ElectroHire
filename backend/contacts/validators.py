"""
Validation rules for chat attachments (photos, documents, voice notes).

Why a separate module: the same rules are needed by the serializer
(contacts/serializers.py) and are easiest to read, change and unit-test
in one place. The frontend keeps a matching copy of the limits in
frontend/src/lib/chatAttachments.js -- if you change a number here,
change it there too, so people get a friendly error *before* uploading
instead of only after.

Security notes (read before relaxing anything):
  - Only a fixed allow-list of file extensions is accepted. Anything
    that a browser could *execute or render as a page* (html, svg, js,
    php, exe ...) is rejected, so an uploaded file can never become a
    stored-XSS vector.
  - We never trust the browser's reported content-type. Images are
    opened with Pillow to prove they really are images; everything else
    is judged by its extension.
"""

import mimetypes
import os
import re

from django.core.exceptions import ValidationError
from PIL import Image, UnidentifiedImageError

MB = 1024 * 1024

MAX_IMAGE_BYTES = 10 * MB
MAX_VOICE_BYTES = 10 * MB
MAX_FILE_BYTES = 15 * MB
MAX_VOICE_SECONDS = 300  # 5 minutes

# Largest request body we are willing to even start parsing (the biggest
# allowed file plus a little room for the multipart envelope).
MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1 * MB

IMAGE_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "webp"}
# Pillow's names for the formats above.
IMAGE_FORMATS = {"JPEG", "PNG", "GIF", "WEBP"}

AUDIO_EXTENSIONS = {"webm", "ogg", "oga", "opus", "mp3", "m4a", "mp4", "aac", "wav"}

DOCUMENT_EXTENSIONS = {
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "ppt",
    "pptx",
    "txt",
    "csv",
    "rtf",
    "odt",
    "ods",
    "odp",
    "zip",
}

TYPE_TEXT = "text"
TYPE_IMAGE = "image"
TYPE_FILE = "file"
TYPE_VOICE = "voice"

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def get_extension(filename):
    """Lower-case extension without the dot ('Photo.JPG' -> 'jpg')."""
    return os.path.splitext(filename or "")[1].lstrip(".").lower()


def clean_filename(filename, max_length=255):
    """
    Display-safe version of the uploaded file's original name.
    Only used for showing the name in the UI -- the file on disk is
    stored under a random uuid name (see models.chat_attachment_path).
    """
    name = os.path.basename((filename or "").replace("\\", "/"))
    name = _CONTROL_CHARS.sub("", name).strip()
    if not name:
        return "file"
    if len(name) > max_length:
        stem, ext = os.path.splitext(name)
        name = stem[: max_length - len(ext)] + ext
    return name


def resolve_message_type(filename, hint=None):
    """
    Decides what kind of message an upload is. The client's `hint` is
    only trusted for 'voice' (a recording has no distinguishing
    extension from other audio files); images and documents are decided
    from the extension so a client can't mislabel one as the other.
    """
    if hint == TYPE_VOICE:
        return TYPE_VOICE
    if get_extension(filename) in IMAGE_EXTENSIONS:
        return TYPE_IMAGE
    return TYPE_FILE


def validate_attachment(uploaded_file, message_type):
    """
    Validates `uploaded_file` for the given `message_type` and returns
    the MIME type to store. Raises django ValidationError (which DRF's
    serializer turns into a normal 400 message) on any problem.
    """
    name = uploaded_file.name or ""
    ext = get_extension(name)
    size = uploaded_file.size or 0

    if size <= 0:
        raise ValidationError("The uploaded file is empty.")

    if message_type == TYPE_IMAGE:
        if ext not in IMAGE_EXTENSIONS:
            raise ValidationError("Only JPG, PNG, GIF or WEBP images can be sent as photos.")
        if size > MAX_IMAGE_BYTES:
            raise ValidationError(f"Photos must be {MAX_IMAGE_BYTES // MB}MB or smaller.")
        return _validate_real_image(uploaded_file)

    if message_type == TYPE_VOICE:
        if ext not in AUDIO_EXTENSIONS:
            raise ValidationError("Unsupported voice message format.")
        if size > MAX_VOICE_BYTES:
            raise ValidationError(f"Voice messages must be {MAX_VOICE_BYTES // MB}MB or smaller.")
        guessed, _ = mimetypes.guess_type(f"x.{ext}")
        # Recordings from browsers are audio-only even when the extension
        # (.webm / .mp4) is also used for video, so force an audio type.
        if guessed and guessed.startswith("audio/"):
            return guessed
        return {"webm": "audio/webm", "mp4": "audio/mp4"}.get(ext, "audio/ogg")

    if message_type == TYPE_FILE:
        if ext not in DOCUMENT_EXTENSIONS:
            raise ValidationError(
                "This file type isn't allowed. Supported: PDF, Word, Excel, "
                "PowerPoint, TXT, CSV, RTF, OpenDocument and ZIP files."
            )
        if size > MAX_FILE_BYTES:
            raise ValidationError(f"Files must be {MAX_FILE_BYTES // MB}MB or smaller.")
        guessed, _ = mimetypes.guess_type(f"x.{ext}")
        return guessed or "application/octet-stream"

    raise ValidationError("Unsupported attachment type.")


def _validate_real_image(uploaded_file):
    """Proves the bytes really are an image (not a renamed script)."""
    try:
        uploaded_file.seek(0)
        with Image.open(uploaded_file) as image:
            image_format = image.format
            image.verify()
    except (UnidentifiedImageError, OSError, SyntaxError, ValueError, Image.DecompressionBombError):
        raise ValidationError("That file isn't a valid image.")
    finally:
        uploaded_file.seek(0)

    if image_format not in IMAGE_FORMATS:
        raise ValidationError("Only JPG, PNG, GIF or WEBP images can be sent as photos.")

    return Image.MIME.get(image_format, "image/jpeg")