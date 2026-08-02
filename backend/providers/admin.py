from django.contrib import admin
from django.utils.html import format_html

from .models import Provider, ProviderCategory

_STATUS_COLORS = {
    "pending": "#c07600",
    "active": "#0a7c3c",
    "rejected": "#b3261e",
}


class ProviderCategoryInline(admin.TabularInline):
    model = ProviderCategory
    extra = 1


@admin.action(description="Approve selected providers (set status = active)")
def approve_providers(modeladmin, request, queryset):
    # Only pending/rejected rows actually change; re-approving an
    # already-active provider is a harmless no-op.
    updated = queryset.exclude(status="active").update(status="active")
    modeladmin.message_user(request, f"{updated} provider(s) approved and set to active.")


@admin.action(description="Reject selected providers (set status = rejected)")
def reject_providers(modeladmin, request, queryset):
    updated = queryset.exclude(status="rejected").update(status="rejected")
    modeladmin.message_user(request, f"{updated} provider(s) rejected.")


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "area", "experience", "status_badge", "created_at"]
    list_filter = ["status", "area"]  # Day 5: Status Filter (Pending/Active) on the list view
    search_fields = ["user__name", "user__email", "area"]
    inlines = [ProviderCategoryInline]
    actions = [approve_providers, reject_providers]

    @admin.display(description="Status", ordering="status")
    def status_badge(self, obj):
        color = _STATUS_COLORS.get(obj.status, "#666")
        return format_html(
            '<b style="color:{}">{}</b>', color, obj.get_status_display()
        )


@admin.register(ProviderCategory)
class ProviderCategoryAdmin(admin.ModelAdmin):
    list_display = ["id", "provider", "category"]