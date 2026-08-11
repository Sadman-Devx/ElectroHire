from django.conf import settings
from django.db import models


class Report(models.Model):
    """
    Report Table — reported_by(FK), reported_id, reported_type, reason,
    details, status (Day 8 schedule / API Contract §6: POST /api/reports/).

    The App Build doc's original schema had a single `reported_provider`
    FK, written before the "Report Feature Bidirectional (User <-> Provider)"
    edge-case decision. The Contract's actual request body -- flat
    `reported_id` + `reported_type` -- reflects that later decision, so
    this model follows the Contract rather than the doc, the same way
    Rating.tags already overrode an earlier App Build draft on Day 7.

    `reported_id` is deliberately a plain PositiveIntegerField, not a
    ForeignKey: it has to resolve against either User.id or Provider.id
    depending on reported_type, and a single FK can't point at two
    different tables. The existence check for reported_id happens at
    the serializer layer (ReportCreateSerializer), same division of
    responsibility as ContactLog-eligibility living in RatingCreateView
    rather than on Rating itself.

    `status` is never in the request body (Contract's success response
    is only status/message) -- it's server-managed, starts at "pending",
    and is moved by the Report Management admin actions.

    Index names are explicit (not auto-generated) so this model and its
    migration stay in sync without needing `makemigrations` to compute
    Django's usual hash-suffixed name.
    """

    TYPE_PROVIDER = "provider"
    TYPE_USER = "user"
    TYPE_CHOICES = (
        (TYPE_PROVIDER, "Provider"),
        (TYPE_USER, "User"),
    )

    REASON_FAKE = "fake"
    REASON_INAPPROPRIATE = "inappropriate"
    REASON_WRONG_INFO = "wrong_info"
    REASON_HARASSMENT = "harassment"
    REASON_OTHER = "other"
    REASON_CHOICES = (
        (REASON_FAKE, "Fake"),
        (REASON_INAPPROPRIATE, "Inappropriate"),
        (REASON_WRONG_INFO, "Wrong Info"),
        (REASON_HARASSMENT, "Harassment"),
        (REASON_OTHER, "Other"),
    )

    STATUS_PENDING = "pending"
    STATUS_RESOLVED = "resolved"
    STATUS_DISMISSED = "dismissed"
    STATUS_CHOICES = (
        (STATUS_PENDING, "Pending"),
        (STATUS_RESOLVED, "Resolved"),
        (STATUS_DISMISSED, "Dismissed"),
    )

    reported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="reports_filed",
    )
    reported_id = models.PositiveIntegerField(
        help_text="ID of the reported User or Provider, per reported_type."
    )
    reported_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    reason = models.CharField(max_length=20, choices=REASON_CHOICES)
    details = models.TextField(blank=True, default="")
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Admin's Report Management filters/searches by these.
            models.Index(
                fields=["reported_type", "reported_id"],
                name="reports_type_target_idx",
            ),
            models.Index(fields=["status"], name="reports_status_idx"),
        ]

    def __str__(self):
        return f"{self.reported_type}:{self.reported_id} by {self.reported_by_id} ({self.status})"