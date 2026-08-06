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
    list_display = ("id", "sender", "receiver", "short_content", "is_read", "created_at")
    list_filter = ("is_read", "created_at")
    search_fields = ("sender__name", "sender__email", "receiver__name", "receiver__email", "content")
    readonly_fields = ("created_at",)

    @admin.display(description="Content")
    def short_content(self, obj):
        return obj.content[:50] + ("…" if len(obj.content) > 50 else "")