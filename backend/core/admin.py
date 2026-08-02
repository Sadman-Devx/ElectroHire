"""
Dev 2, Day 5 — Django Admin Customize + Admin Dashboard Basic Stats.

This module doesn't register any model of its own. Instead it:
  1. Brands the shared `admin.site` (header/title) so it reads
     "ElectroHire Admin" instead of Django's generic default.
  2. Wraps `admin.site.index` to inject `dashboard_stats` (Total Users,
     Total Providers, Pending Providers, Active Providers) into the
     template context, rendered by templates/admin/index.html.

Why here and not a new AdminSite subclass: every other app already
registers its models against the default `django.contrib.admin.site`
via `@admin.register(...)` (see providers/admin.py, categories/admin.py,
users/admin.py). Swapping in a custom AdminSite would mean re-wiring
electrohire/urls.py and every existing @admin.register call across
three devs' apps. Wrapping the existing site's `index` method achieves
the same "Admin Dashboard Basic Stats" requirement with a single,
additive change that can't break anyone else's registrations.
"""
from django.contrib import admin
from django.contrib.auth import get_user_model

from providers.models import Provider

User = get_user_model()

admin.site.site_header = "ElectroHire Admin"
admin.site.site_title = "ElectroHire Admin"
admin.site.index_title = "Dashboard"

# Keep a handle on the original bound method so our wrapper can still
# render the normal app-list index underneath the stats block.
_default_index = admin.site.index


def _index_with_dashboard_stats(request, extra_context=None):
    extra_context = extra_context or {}
    extra_context["dashboard_stats"] = {
        "total_users": User.objects.filter(role=User.ROLE_USER).count(),
        "total_providers": Provider.objects.count(),
        "pending_providers": Provider.objects.filter(status="pending").count(),
        "active_providers": Provider.objects.filter(status="active").count(),
    }
    return _default_index(request, extra_context)


admin.site.index = _index_with_dashboard_stats