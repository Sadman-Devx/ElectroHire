from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.response import error_response, success_response

from .models import WalletTransaction
from .serializers import WalletTransactionSerializer
from .services import get_wallet_summary

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100
RECENT_ON_SUMMARY = 5


def _provider_or_404(request):
    provider = getattr(request.user, "provider_profile", None)
    if provider is None:
        return None, error_response(
            "You do not have a provider profile", status_code=status.HTTP_404_NOT_FOUND
        )
    return provider, None


def _int_param(request, name, default, minimum, maximum):
    try:
        value = int(request.query_params.get(name, default))
    except (TypeError, ValueError):
        return default
    return max(minimum, min(value, maximum))


class WalletSummaryView(APIView):
    """
    GET /api/wallet/

    The signed-in provider's wallet: balance, what they owe (due), what
    is available, the due limit and whether it has been reached, lifetime
    totals, and the latest few ledger lines. 404s for an account with no
    provider profile (same "you're not a provider" signal as the other
    provider-only endpoints).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider, failure = _provider_or_404(request)
        if failure is not None:
            return failure

        data = get_wallet_summary(provider)
        recent = WalletTransaction.objects.filter(wallet__provider=provider)[
            :RECENT_ON_SUMMARY
        ]
        data["recent_transactions"] = WalletTransactionSerializer(recent, many=True).data
        return success_response(data=data)


class WalletTransactionListView(APIView):
    """
    GET /api/wallet/transactions/?limit=20&offset=0&type=cash_commission

    The provider's ledger statement, newest first. `count` is the total
    number of matching lines so the page can show "load more".
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider, failure = _provider_or_404(request)
        if failure is not None:
            return failure

        limit = _int_param(request, "limit", DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE)
        offset = _int_param(request, "offset", 0, 0, 10**9)

        queryset = WalletTransaction.objects.filter(wallet__provider=provider)
        entry_type = request.query_params.get("type")
        if entry_type:
            valid = {value for value, _label in WalletTransaction.ENTRY_CHOICES}
            if entry_type not in valid:
                return error_response(
                    "Unknown transaction type", status_code=status.HTTP_400_BAD_REQUEST
                )
            queryset = queryset.filter(entry_type=entry_type)

        total = queryset.count()
        page = queryset[offset : offset + limit]
        data = WalletTransactionSerializer(page, many=True).data
        return success_response(
            data=data,
            count=total,
            has_more=offset + len(data) < total,
        )