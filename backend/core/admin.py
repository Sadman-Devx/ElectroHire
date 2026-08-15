"""
Dev 2, Day 5 — Django Admin Customize + Admin Dashboard Basic Stats.
Dev 2, Day 9 — Admin Dashboard Stats Complete.

This module doesn't register any model of its own. Instead it:
  1. Brands the shared `admin.site` (header/title) so it reads
     "ElectroHire Admin" instead of Django's generic default.
  2. Wraps `admin.site.index` to inject `dashboard_stats` into the
     template context, rendered by templates/admin/index.html.

Why here and not a new AdminSite subclass: every other app already
registers its models against the default `django.contrib.admin.site`
via `@admin.register(...)` (see providers/admin.py, categories/admin.py,
users/admin.py). Swapping in a custom AdminSite would mean re-wiring
electrohire/urls.py and every existing @admin.register call across
three devs' apps. Wrapping the existing site's `index` method achieves
the same "Admin Dashboard Stats" requirement with a single, additive
change that can't break anyone else's registrations.

Day 9 additions — total_contacts, total_ratings, contact_rate:
The App Build doc's Admin Panel section explicitly calls out this
dashboard as "Success Metric দেখার জায়গা (Primary: Contact Rate)".
contact_rate is defined here as the share of plain "user"-role accounts
that have logged at least one ContactLog — i.e. what fraction of
registered customers have actually gone on to contact a provider, the
platform's core conversion event. `.values("user_id").distinct()`
rather than a plain ContactLog.count(), since a per-USER engagement
rate must count each user once regardless of how many providers they
contacted, not once per contact row.
"""
from django.contrib import admin
from django.contrib.auth import get_user_model

from contacts.models import ContactLog
from providers.models import Provider
from ratings.models import Rating

User = get_user_model()

admin.site.site_header = "ElectroHire Admin"
admin.site.site_title = "ElectroHire Admin"
admin.site.index_title = "Dashboard"

# Keep a handle on the original bound method so our wrapper can still
# render the normal app-list index underneath the stats block.
_default_index = admin.site.index


def _index_with_dashboard_stats(request, extra_context=None):
    extra_context = extra_context or {}

    total_users = User.objects.filter(role=User.ROLE_USER).count()
    contacted_users = ContactLog.objects.values("user_id").distinct().count()
    contact_rate = (
        round((contacted_users / total_users) * 100, 1) if total_users else 0.0
    )

    extra_context["dashboard_stats"] = {
        "total_users": total_users,
        "total_providers": Provider.objects.count(),
        "pending_providers": Provider.objects.filter(status="pending").count(),
        "active_providers": Provider.objects.filter(status="active").count(),
        # --- Day 9, Dev 2 ---
        "total_contacts": ContactLog.objects.count(),
        "total_ratings": Rating.objects.count(),
        "contact_rate": contact_rate,
    }
    return _default_index(request, extra_context)


admin.site.index = _index_with_dashboard_stats