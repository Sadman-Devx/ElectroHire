from decimal import Decimal

from django.contrib import admin, messages
from django.db.models import Sum
from django.utils import timezone

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "provider",
        "category",
        "scheduled_date",
        "scheduled_time",
        "status",
        "quoted_price",
        "commission_amount",
        "commission_status",
        "created_at",
    )
    list_filter = ("status", "commission_status", "payment_method", "category")
    search_fields = (
        "user__name",
        "user__email",
        "provider__user__name",
        "address",
        "commission_reference",
    )
    autocomplete_fields = ("user", "provider", "category")
    # Money fields are written only by the booking workflow / admin
    # actions below, never typed in by hand -- so the amounts always
    # match the rate that applied when the provider quoted the job.
    readonly_fields = (
        "quoted_price",
        "commission_rate",
        "commission_amount",
        "commission_status",
        "payment_method",
        "completed_at",
        "commission_paid_at",
        "created_at",
        "updated_at",
    )
    fieldsets = (
        (
            "Booking",
            {
                "fields": (
                    "user",
                    "provider",
                    "category",
                    "scheduled_date",
                    "scheduled_time",
                    "address",
                    "description",
                    "status",
                    "completed_at",
                )
            },
        ),
        (
            "Price & commission (charged to the provider only)",
            {
                "fields": (
                    "quoted_price",
                    "commission_rate",
                    "commission_amount",
                    "commission_status",
                    "payment_method",
                    "commission_paid_at",
                    "commission_reference",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
    actions = ("mark_commission_paid", "waive_commission")

    def changelist_view(self, request, extra_context=None):
        # One glance at the top of the list: how much are providers
        # currently holding that belongs to the platform?
        if request.method == "GET":
            total = Booking.objects.filter(
                commission_status=Booking.COMMISSION_DUE
            ).aggregate(total=Sum("commission_amount"))["total"] or Decimal("0.00")
            self.message_user(
                request,
                f"Total commission due from providers: {total:.2f}",
                level=messages.INFO,
            )
        return super().changelist_view(request, extra_context)

    @admin.action(description="Mark selected commission as PAID by provider")
    def mark_commission_paid(self, request, queryset):
        now = timezone.now()
        updated = queryset.filter(commission_status=Booking.COMMISSION_DUE).update(
            commission_status=Booking.COMMISSION_PAID,
            commission_paid_at=now,
            updated_at=now,
        )
        skipped = queryset.count() - updated
        self.message_user(
            request,
            f"{updated} commission(s) marked as paid."
            + (f" {skipped} skipped (not in 'Due' state)." if skipped else ""),
            level=messages.SUCCESS if updated else messages.WARNING,
        )

    @admin.action(description="WAIVE selected commission (forgive the amount)")
    def waive_commission(self, request, queryset):
        now = timezone.now()
        updated = queryset.filter(
            commission_status__in=[Booking.COMMISSION_DUE, Booking.COMMISSION_PENDING]
        ).update(commission_status=Booking.COMMISSION_WAIVED, updated_at=now)
        skipped = queryset.count() - updated
        self.message_user(
            request,
            f"{updated} commission(s) waived."
            + (f" {skipped} skipped (nothing to waive)." if skipped else ""),
            level=messages.SUCCESS if updated else messages.WARNING,
        )