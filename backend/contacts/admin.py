from django.contrib import admin

from .models import ContactLog


@admin.register(ContactLog)
class ContactLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "provider", "contacted_at")
    list_filter = ("contacted_at",)
    search_fields = ("user__name", "user__email", "provider__user__name")
    readonly_fields = ("contacted_at",)