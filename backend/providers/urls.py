from django.urls import path

from .views import ProviderDetailView, ProviderProfileSetupView

app_name = "providers"

urlpatterns = [
    path("profile/", ProviderProfileSetupView.as_view(), name="profile-setup"),

    # ── Coordination note for Dev 1 (Day 4) ──────────────────────
    # GET /api/providers/  — Provider list with search/filter
    #   (?category=<id>&area=<name>&sort=rating) — is Dev 1's endpoint.
    # Add it above as:
    #     path("", ProviderListView.as_view(), name="list"),
    # It's a distinct literal path ("") so it won't collide with
    # "profile/" or "<int:pk>/" below regardless of ordering.
    path("<int:pk>/", ProviderDetailView.as_view(), name="detail"),
]