from django.urls import path

from .views import RatingCreateView

app_name = "ratings"

urlpatterns = [
    path("", RatingCreateView.as_view(), name="create"),
]