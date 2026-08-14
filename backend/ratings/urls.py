from django.urls import path

from .views import MyRatingListView, RatingCreateView

app_name = "ratings"

urlpatterns = [
    path("", RatingCreateView.as_view(), name="create"),
    # --- Day 9, Dev 1 ---
    path("mine/", MyRatingListView.as_view(), name="mine"),
]