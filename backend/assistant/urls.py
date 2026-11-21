from django.urls import path

from .views import AnalyzeProblemView, BookingDraftView

app_name = "assistant"

urlpatterns = [
    path("analyze/", AnalyzeProblemView.as_view(), name="analyze"),
    path("booking-draft/", BookingDraftView.as_view(), name="booking-draft"),
]
