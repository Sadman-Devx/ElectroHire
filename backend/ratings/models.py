from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from providers.models import Provider


class Rating(models.Model):
    """
    Rating Table (App Build doc, Phase 3 schema): id, user_id, provider_id,
    rating_value, review_text, created_at.

    `tags` is added per the API Contract's POST /api/ratings/ request body
    (["on_time", "professional"]) and the schedule's "tags(JSON)" field spec
    -- stored as a plain JSONField list of short tag strings, same idea as
    ProviderCategory being an explicit join elsewhere in this project, just
    simple enough here that a JSON list is the pragmatic choice instead of
    a fourth model + junction table.

    Eligibility (App Build Step 8 -- "shudhu jader contact_log ache tara-i
    rate korte parbe") is enforced at the *view* layer, not here, by
    checking contacts.models.ContactLog before a Rating is ever created --
    mirrors how ProviderProfileSetupSerializer keeps request-shape
    validation in the serializer/view and leaves the model itself a plain
    data record.

    One rating per (user, provider) is enforced at the DB level, same
    pattern as ContactLog's unique_user_provider_contact constraint --
    a user revising their opinion should update their existing rating,
    not stack duplicates that would double-count in avg_rating.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="ratings",
    )
    rating_value = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    review_text = models.TextField(blank=True, default="")
    tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "provider"],
                name="unique_user_provider_rating",
            )
        ]

    def __str__(self):
        return f"{self.user_id} -> {self.provider_id}: {self.rating_value}/5"