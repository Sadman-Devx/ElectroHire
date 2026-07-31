from django.urls import path

from .views import CategoryListView

app_name = "categories"

urlpatterns = [
    path("", CategoryListView.as_view(), name="list"),
]