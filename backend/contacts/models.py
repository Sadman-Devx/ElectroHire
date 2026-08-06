from django.conf import settings
from django.db import models

from providers.models import Provider


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
    """

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
    content = models.TextField(max_length=2000)
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
        return f"{self.sender_id} -> {self.receiver_id}: {self.content[:30]!r}"