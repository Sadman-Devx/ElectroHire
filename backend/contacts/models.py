import os
import uuid

from django.conf import settings
from django.db import models
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone

from providers.models import Provider


def chat_attachment_path(instance, filename):
    """
    Where a chat attachment is stored: chat_attachments/YYYY/MM/<uuid>.<ext>

    The original name is never used on disk. A random uuid makes the URL
    impossible to guess (anyone *with* the link can open it, nobody can
    discover it) and removes any risk from odd characters or path tricks
    in a user-supplied file name. The original name is kept separately in
    Message.attachment_name purely for display.
    """
    ext = os.path.splitext(filename or "")[1].lower()
    now = timezone.now()
    return f"chat_attachments/{now:%Y}/{now:%m}/{uuid.uuid4().hex}{ext}"


class ContactLog(models.Model):
    """
    Records the first time a user contacts a provider.
    Used later (Day 7) as the eligibility check for ratings.
    Enforced unique at the DB level so a user can 'reveal number' or
    contact the same provider repeatedly without creating duplicate rows.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="contact_logs",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="contact_logs",
    )
    contacted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["user", "provider"],
                name="unique_user_provider_contact",
            )
        ]
        ordering = ["-contacted_at"]

    def __str__(self):
        return f"{self.user_id} -> {self.provider_id} @ {self.contacted_at}"


class Message(models.Model):
    """
    Message Table (App Build doc, Phase 3 schema): id, sender_id,
    receiver_id, content, created_at, is_read.

    `sender` / `receiver` are plain Users (not Providers) — a provider
    is just a User with role="provider", so the same table serves both
    directions of a conversation without a separate "who's the provider"
    column. Which Provider a thread belongs to is derived at query time
    via the receiver/sender's `provider_profile` (see MessageListCreateView),
    exactly like ContactLog already keys off `provider`, not `provider.user`,
    everywhere else in this app.

    Attachments (photo / file / voice note): a message is still ONE row.
    `message_type` says what it is, `attachment` holds the uploaded file
    and the small `attachment_*` / `duration_seconds` columns hold the
    display info the chat bubble needs (so the list endpoint never has to
    open the file on disk). For image/file messages `content` is an
    optional caption; for voice messages it is empty.
    """

    TYPE_TEXT = "text"
    TYPE_IMAGE = "image"
    TYPE_FILE = "file"
    TYPE_VOICE = "voice"
    TYPE_CHOICES = [
        (TYPE_TEXT, "Text"),
        (TYPE_IMAGE, "Image"),
        (TYPE_FILE, "File"),
        (TYPE_VOICE, "Voice message"),
    ]

    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_messages",
    )
    receiver = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_messages",
    )
    # blank=True: a photo / voice note can be sent with no text at all.
    content = models.TextField(max_length=2000, blank=True, default="")
    message_type = models.CharField(
        max_length=10, choices=TYPE_CHOICES, default=TYPE_TEXT
    )
    attachment = models.FileField(
        upload_to=chat_attachment_path, null=True, blank=True
    )
    attachment_name = models.CharField(max_length=255, blank=True, default="")
    attachment_size = models.PositiveIntegerField(default=0)
    attachment_mime = models.CharField(max_length=100, blank=True, default="")
    duration_seconds = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    class Meta:
        ordering = ["created_at"]
        indexes = [
            # Fetching/marking-read a thread always filters by these pairs.
            models.Index(fields=["sender", "receiver", "created_at"]),
            models.Index(fields=["receiver", "sender", "is_read"]),
        ]

    def __str__(self):
        return f"{self.sender_id} -> {self.receiver_id}: {self.preview[:30]!r}"

    @property
    def preview(self):
        """
        One-line summary used where the full bubble can't be shown
        (conversation list "last message", admin list, notifications).
        Plain text messages return their content unchanged, so existing
        behaviour for text-only chats is untouched.
        """
        if self.message_type == self.TYPE_IMAGE:
            return f"📷 {self.content}" if self.content else "📷 Photo"
        if self.message_type == self.TYPE_VOICE:
            return "🎤 Voice message"
        if self.message_type == self.TYPE_FILE:
            return f"📎 {self.attachment_name or 'File'}"
        return self.content


@receiver(post_delete, sender=Message)
def delete_attachment_file_with_message(sender, instance, **kwargs):
    """
    Removes the uploaded file from disk when its Message row is deleted
    (directly, via admin, or because a User was deleted and the rows
    cascaded) so orphaned files don't pile up in MEDIA_ROOT forever.
    """
    if instance.attachment:
        instance.attachment.delete(save=False)