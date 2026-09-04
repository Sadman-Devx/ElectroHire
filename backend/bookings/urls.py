from django.urls import path

from .views import (
    BookingCreateView,
    BookingListView,
    BookingStatusUpdateView,
    ProviderBookingListView,
)

app_name = "bookings"

urlpatterns = [
    path("", BookingCreateView.as_view(), name="create"),
    path("mine/", BookingListView.as_view(), name="list-mine"),
    # --- literal path, registered ahead of "<int:pk>/status/" for the
    # same top-to-bottom resolution reason providers/urls.py already
    # documents for "dashboard/" and "me/".
    path("provider/", ProviderBookingListView.as_view(), name="list-provider"),
    path(
        "<int:pk>/status/", BookingStatusUpdateView.as_view(), name="status-update"
    ),
]