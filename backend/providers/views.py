from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.response import error_response, first_error_message, success_response

from .models import Provider
from .serializers import ProviderDetailSerializer, ProviderProfileSetupSerializer


# ── Dev 2, Day 4 ─────────────────────────────────────────────────────
class ProviderProfileSetupView(APIView):
    """
    POST /api/providers/profile/

    - Auth Required (JWT Token Header-এ)
    - Multiple Categories Accept করে
    - Photo Upload Handle করে (MEDIA_ROOT)
    - Status 'pending' Set করে on every write (create or edit/resubmit)
    """

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = ProviderProfileSetupSerializer(
            data=request.data, context={"request": request}
        )
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=400,
                errors=serializer.errors,
            )

        serializer.save()
        return success_response(
            message="Profile submitted for review", status_code=201
        )


# ── Dev 2, Day 4 ─────────────────────────────────────────────────────
class ProviderDetailView(APIView):
    """
    GET /api/providers/{id}/  — public, no auth required.
    """

    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            provider = (
                Provider.objects.select_related("user")
                .prefetch_related("categories")
                .get(pk=pk)
            )
        except Provider.DoesNotExist:
            return error_response("Provider not found", status_code=404)

        serializer = ProviderDetailSerializer(
            provider, context={"request": request}
        )
        return success_response(data=serializer.data, status_code=200)