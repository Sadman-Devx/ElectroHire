from django.contrib import admin
from django.contrib.auth import get_user_model

from providers.models import Provider

from .models import Report

User = get_user_model()


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    """
    Report Management (App Build doc's Admin Panel structure): status
    filter + Block/Dismiss action on every submitted report.

    "Dismiss" maps directly to Report.status='dismissed'. "Block" isn't
    a Report.status value -- the schedule's status choices are only
    pending/resolved/dismissed -- it means deactivating whichever
    account reported_id/reported_type points at, then closing the
    report as resolved. Since reported_id is a generic reference (see
    models.py), that resolution happens here. Provider has no dedicated
    "blocked" state in its own STATUS_CHOICES, so a blocked provider is
    set to "rejected" (already its inactive state elsewhere in this
    app); a blocked user is deactivated via the standard
    `is_active=False`, which Django's own auth already treats as
    "can't log in" without deleting their data.
    """

    list_display = (
        "id",
        "reported_by",
        "reported_type",
        "reported_id",
        "reason",
        "status",
        "created_at",
    )
    list_filter = ("status", "reported_type", "reason")
    search_fields = ("reported_by__name", "reported_by__email", "details")
    autocomplete_fields = ("reported_by",)
    actions = ["dismiss_reports", "block_reported_entity"]

    @admin.action(description="Dismiss selected reports")
    def dismiss_reports(self, request, queryset):
        updated = queryset.update(status=Report.STATUS_DISMISSED)
        self.message_user(request, f"{updated} report(s) dismissed.")

    @admin.action(description="Block reported account(s) and resolve report")
    def block_reported_entity(self, request, queryset):
        blocked = 0
        for report in queryset:
            if report.reported_type == Report.TYPE_PROVIDER:
                updated = Provider.objects.filter(id=report.reported_id).update(
                    status="rejected"
                )
            else:
                updated = User.objects.filter(id=report.reported_id).update(
                    is_active=False
                )
            if updated:
                blocked += 1

        queryset.update(status=Report.STATUS_RESOLVED)
        self.message_user(
            request, f"Blocked {blocked} account(s); report(s) marked resolved."
        )