from decimal import Decimal

from django.conf import settings
from django.db import models

from providers.models import Provider


class Booking(models.Model):
    """
    Booking Table — a user asking a specific provider to do a job on a
    given date (the step *after* Contact/Chat).

    `category` is a nullable FK rather than re-deriving it from
    provider.categories — a provider can offer several categories and the
    customer may say which job this booking is for.

    `scheduled_date` + `scheduled_time` are two separate fields (DateField
    + TimeField), mirroring the frontend's separate date/time pickers.

    STATUS_CHOICES models a one-way lifecycle enforced in the view layer
    (BookingStatusUpdateView), not here:
        pending -> confirmed -> completed
        pending -> rejected
        pending/confirmed -> cancelled

    Provider-only commission (see bookings/commission.py for the rules)
    ------------------------------------------------------------------
    The customer is shown `quoted_price` as the final total. The platform
    commission is charged to the PROVIDER only:
      - quoted_price      the provider's quote, set when they confirm.
      - commission_rate   percent snapshot at quote time, so changing the
                          rate later never rewrites old bookings.
      - commission_amount quoted_price x rate, snapshot at quote time.
      - commission_status where that money stands (COMMISSION_* below).
      - payment_method    "cash" (provider collects, owes commission) or
                          "online" (reserved: platform collects and
                          deducts commission from the payout).
      - completed_at      when the provider marked the job completed.
      - commission_paid_at / commission_reference
                          filled by admin when the provider settles dues.
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

    PAYMENT_CASH = "cash"
    PAYMENT_ONLINE = "online"
    PAYMENT_CHOICES = (
        (PAYMENT_CASH, "Cash to provider"),
        (PAYMENT_ONLINE, "Online via platform"),
    )

    COMMISSION_NONE = "none"
    COMMISSION_PENDING = "pending"
    COMMISSION_DUE = "due"
    COMMISSION_PAID = "paid"
    COMMISSION_WAIVED = "waived"
    COMMISSION_DEDUCTED = "deducted"
    COMMISSION_STATUS_CHOICES = (
        (COMMISSION_NONE, "No commission"),
        (COMMISSION_PENDING, "Not yet due"),
        (COMMISSION_DUE, "Due from provider"),
        (COMMISSION_PAID, "Paid by provider"),
        (COMMISSION_WAIVED, "Waived"),
        (COMMISSION_DEDUCTED, "Deducted from online payment"),
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

    # --- Provider-only commission --------------------------------------
    quoted_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, null=True, blank=True
    )
    commission_amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    commission_status = models.CharField(
        max_length=20,
        choices=COMMISSION_STATUS_CHOICES,
        default=COMMISSION_NONE,
    )
    payment_method = models.CharField(
        max_length=10, choices=PAYMENT_CHOICES, default=PAYMENT_CASH
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    commission_paid_at = models.DateTimeField(null=True, blank=True)
    commission_reference = models.CharField(max_length=100, blank=True, default="")

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
            # "How much does this provider owe us?" is asked on every
            # confirm and on every commission-summary load.
            models.Index(
                fields=["provider", "commission_status"],
                name="bookings_prov_comm_idx",
            ),
        ]

    def __str__(self):
        return f"{self.user_id} -> {self.provider_id} @ {self.scheduled_date} ({self.status})"

    @property
    def provider_net_amount(self):
        """What the provider keeps after commission, or None if no quote/commission."""
        if self.quoted_price is None or self.commission_status == self.COMMISSION_NONE:
            return None
        return (self.quoted_price - self.commission_amount).quantize(Decimal("0.01"))