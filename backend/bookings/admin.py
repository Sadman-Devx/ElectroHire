from decimal import Decimal

from django.contrib import admin, messages
from django.db.models import Sum
from django.utils import timezone

from wallet.services import (
    ONLINE_CREDITED,
    ONLINE_MARKED,
    WalletError,
    mark_booking_paid_online,
    settle_booking_commission,
)

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
        "commission_settled_amount",
        "commission_status",
        "payment_method",
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
    # Money fields are written only by the booking workflow / the wallet
    # services (admin actions below), never typed in by hand -- so the
    # amounts always match the ledger and the rate that applied when the
    # provider quoted the job.
    readonly_fields = (
        "quoted_price",
        "commission_rate",
        "commission_amount",
        "commission_settled_amount",
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
                    "commission_settled_amount",
                    "commission_status",
                    "payment_method",
                    "commission_paid_at",
                    "commission_reference",
                )
            },
        ),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
    actions = ("mark_paid_online", "mark_commission_paid", "waive_commission")

    def changelist_view(self, request, extra_context=None):
        # One glance at the top of the list: how much are providers
        # currently holding that belongs to the platform? Read from the
        # wallets (the single source of truth), not from booking rows.
        if request.method == "GET":
            from wallet.models import ProviderWallet

            total = -(
                ProviderWallet.objects.filter(balance__lt=0).aggregate(
                    total=Sum("balance")
                )["total"]
                or Decimal("0.00")
            )
            self.message_user(
                request,
                f"Total commission due from providers: {total:.2f}",
                level=messages.INFO,
            )
        return super().changelist_view(request, extra_context)

    @admin.action(
        description="Record ONLINE payment received (platform holds the money)"
    )
    def mark_paid_online(self, request, queryset):
        marked = credited = skipped = 0
        for booking_id in queryset.values_list("pk", flat=True):
            result = mark_booking_paid_online(booking_id, actor=request.user)
            if result == ONLINE_CREDITED:
                credited += 1
            elif result == ONLINE_MARKED:
                marked += 1
            else:
                skipped += 1
        self.message_user(
            request,
            f"{credited} completed job(s) credited to provider wallets, "
            f"{marked} confirmed job(s) flagged as paid online (credited when completed)."
            + (
                f" {skipped} skipped (needs a quote, confirmed/completed status, "
                "and no earlier ledger entry)."
                if skipped
                else ""
            ),
            level=messages.SUCCESS if (credited or marked) else messages.WARNING,
        )

    @admin.action(description="Mark selected commission as PAID by provider")
    def mark_commission_paid(self, request, queryset):
        updated = 0
        for booking_id in queryset.values_list("pk", flat=True):
            try:
                if settle_booking_commission(
                    booking_id, "paid", actor=request.user
                ):
                    updated += 1
            except WalletError as exc:
                self.message_user(request, str(exc), level=messages.ERROR)
        skipped = queryset.count() - updated
        self.message_user(
            request,
            f"{updated} commission(s) marked as paid."
            + (f" {skipped} skipped (not in 'Due' state)." if skipped else ""),
            level=messages.SUCCESS if updated else messages.WARNING,
        )

    @admin.action(description="WAIVE selected commission (forgive the amount)")
    def waive_commission(self, request, queryset):
        updated = 0
        # Already due -> goes through the ledger so the wallet stays correct.
        for booking_id in queryset.filter(
            commission_status=Booking.COMMISSION_DUE
        ).values_list("pk", flat=True):
            try:
                if settle_booking_commission(
                    booking_id, "waived", actor=request.user
                ):
                    updated += 1
            except WalletError as exc:
                self.message_user(request, str(exc), level=messages.ERROR)
        # Not yet due -> no ledger line exists yet, just forgive it up front.
        updated += queryset.filter(
            commission_status=Booking.COMMISSION_PENDING
        ).update(
            commission_status=Booking.COMMISSION_WAIVED,
            updated_at=timezone.now(),
        )
        skipped = queryset.count() - updated
        self.message_user(
            request,
            f"{updated} commission(s) waived."
            + (f" {skipped} skipped (nothing to waive)." if skipped else ""),
            level=messages.SUCCESS if updated else messages.WARNING,
        )