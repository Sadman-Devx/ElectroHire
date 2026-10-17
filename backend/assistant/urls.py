from django.urls import path

from .views import AnalyzeProblemView

app_name = "assistant"

urlpatterns = [
    path("analyze/", AnalyzeProblemView.as_view(), name="analyze"),
]
