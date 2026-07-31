from django.urls import path

from .views import ProviderDetailView, ProviderListView, ProviderProfileSetupView

app_name = "providers"

urlpatterns = [
    path("profile/", ProviderProfileSetupView.as_view(), name="profile-setup"),
    path("", ProviderListView.as_view(), name="list"),
    path("<int:pk>/", ProviderDetailView.as_view(), name="detail"),
]