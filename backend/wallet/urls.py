from django.urls import path

from .views import WalletSummaryView, WalletTransactionListView

app_name = "wallet"

urlpatterns = [
    path("", WalletSummaryView.as_view(), name="summary"),
    path("transactions/", WalletTransactionListView.as_view(), name="transactions"),
]