from django.contrib import admin

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
        "created_at",
    )
    list_filter = ("status", "category")
    search_fields = ("user__name", "user__email", "provider__user__name", "address")
    autocomplete_fields = ("user", "provider", "category")
    readonly_fields = ("created_at", "updated_at")