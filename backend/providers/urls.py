from django.urls import path

# --- Dev 2, Day 7 ---
# ProviderRatingListView lives in ratings/views.py (it queries the Rating
# model, which providers/ has no reason to import), but the route itself
# nests under /api/providers/{id}/ratings/ per the API Contract, so it's
# registered here alongside the rest of the provider-scoped URLs rather
# than under /api/ratings/.
from ratings.views import ProviderRatingListView

from .views import (
    ProviderDashboardView,
    ProviderDetailView,
    ProviderListView,
    ProviderProfileSetupView,
)

app_name = "providers"

urlpatterns = [
    path("profile/", ProviderProfileSetupView.as_view(), name="profile-setup"),
    # --- Day 9, Dev 2 --- literal path, registered ahead of "<int:pk>/"
    # for the same top-to-bottom resolution reason contacts/urls.py
    # already documents for its own literal-before-variable routes.
    path("dashboard/", ProviderDashboardView.as_view(), name="dashboard"),
    path("", ProviderListView.as_view(), name="list"),
    path("<int:pk>/", ProviderDetailView.as_view(), name="detail"),
    path("<int:pk>/ratings/", ProviderRatingListView.as_view(), name="ratings-list"),
]