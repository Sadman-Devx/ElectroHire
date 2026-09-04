from django.conf import settings
from django.db import models

from providers.models import Provider


class Booking(models.Model):
    """
    Booking Table — new feature, not in the API Contract PDF or App
    Build doc (both predate this request). Modeled after the same
    conventions Report/Rating/ContactLog already establish in this
    project: a plain APIView-backed model, explicit index names (no
    makemigrations access in this sandbox — see the migration's
    docstring), and business-rule checks kept out of the model itself.

    A Booking is a user asking a specific provider to do a job on a
    given date — the step *after* Contact/Chat ("Kal sokal 9 tar dike
    ashun" in the API Contract's own chat example already implies a
    scheduled visit; this feature makes that schedulable data instead
    of just chat text).

    `category` is a nullable FK (not required) rather than re-deriving
    it from provider.categories — a provider can offer several
    categories (ProviderCategory, providers/models.py), and the
    customer may want to say which specific job this booking is for,
    but the field is optional since a provider with only one category
    doesn't need the customer to repeat it.

    `scheduled_date` + `scheduled_time` are kept as two separate fields
    (DateField + TimeField) rather than one DateTimeField, mirroring
    why this project already treats dates and times as distinct concepts
    elsewhere (see providers/views.py's DateField/DateTimeField
    coercion-bug fix, Day 4) — the frontend's date-picker and
    time-picker are two separate form controls, and keeping the model
    shaped the same way avoids a similar coercion mismatch here.

    STATUS_CHOICES models a simple one-way lifecycle enforced in the
    view layer (BookingStatusUpdateView), not here:
        pending -> confirmed -> completed
        pending -> rejected
        pending/confirmed -> cancelled
    """

    STATUS_PENDING = "pending"
    STATUS_CONFIRMED = "confirmed"
    STATUS_COMPLETED = "completed"
    STATUS_CANCELLED = "cancelled"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_CONFIRMED, "Confirmed"),
        (STATUS_COMPLETED, "Completed"),
        (STATUS_CANCELLED, "Cancelled"),
        (STATUS_REJECTED, "Rejected"),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="bookings",
        help_text="The customer who made this booking.",
    )
    provider = models.ForeignKey(
        Provider,
        on_delete=models.CASCADE,
        related_name="bookings",
    )
    category = models.ForeignKey(
        "categories.Category",
        on_delete=models.SET_NULL,
        related_name="bookings",
        null=True,
        blank=True,
    )
    scheduled_date = models.DateField()
    scheduled_time = models.TimeField()
    address = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-scheduled_date", "-scheduled_time"]
        indexes = [
            # Provider's incoming-bookings list filters/sorts by these.
            models.Index(
                fields=["provider", "status"], name="bookings_provider_status_idx"
            ),
            # Customer's "my bookings" list filters by these.
            models.Index(fields=["user", "status"], name="bookings_user_status_idx"),
        ]

    def __str__(self):
        return f"{self.user_id} -> {self.provider_id} @ {self.scheduled_date} ({self.status})"