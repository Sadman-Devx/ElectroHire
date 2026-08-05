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