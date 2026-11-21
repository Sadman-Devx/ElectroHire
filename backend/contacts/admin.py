from django.contrib import admin

from .models import ContactLog, Message


@admin.register(ContactLog)
class ContactLogAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "provider", "contacted_at")
    list_filter = ("contacted_at",)
    search_fields = ("user__name", "user__email", "provider__user__name")
    readonly_fields = ("contacted_at",)


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "sender",
        "receiver",
        "message_type",
        "short_content",
        "is_read",
        "created_at",
    )
    list_filter = ("message_type", "is_read", "created_at")
    search_fields = (
        "sender__name",
        "sender__email",
        "receiver__name",
        "receiver__email",
        "content",
        "attachment_name",
    )
    readonly_fields = ("created_at", "attachment_size", "attachment_mime")

    @admin.display(description="Content")
    def short_content(self, obj):
        text = obj.preview
        return text[:50] + ("…" if len(text) > 50 else "")