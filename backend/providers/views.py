from django.db.models import Avg, Count
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from core.response import error_response, first_error_message, success_response

from .models import Provider
from .serializers import (
    ProviderDetailSerializer,
    ProviderListSerializer,
    ProviderProfileSetupSerializer,
)


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

# ── Dev 1, Day 4 ─────────────────────────────────────────────────────
class ProviderListView(ListAPIView):
    """
    GET /api/providers/  — public, no auth required.

    Query params (all optional, combinable):
        ?category=<id>   filter to providers offering this category
        ?area=<text>     case-insensitive partial match on area
        ?sort=rating     highest avg_rating first (default: newest first)

    Response:
        {"status": "success", "count": 24, "data": [...]}

    Decisions (contract didn't spell these out — flagging for the team):
      - Only status="active" providers are shown publicly.
      - area filter is case-insensitive partial match (icontains).
      - No pagination — contract's example response is a flat "data"
        array with "count", not next/previous cursors.
    """

    serializer_class = ProviderListSerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def get_queryset(self):
        qs = (
            Provider.objects.filter(status="active")
            .select_related("user")
            .prefetch_related("categories")
            # Day 7, Dev 2: real Avg/Count annotation, consumed by
            # ProviderListSerializer.get_avg_rating/get_review_count via
            # the `_avg_rating`/`_review_count` attribute names below
            # (avoids colliding with the serializer's own output field
            # names "avg_rating"/"review_count").
            .annotate(
                _avg_rating=Avg("ratings__rating_value"),
                _review_count=Count("ratings", distinct=True),
            )
        )

        category_id = self.request.query_params.get("category")
        if category_id:
            qs = qs.filter(categories__id=category_id)

        area = self.request.query_params.get("area")
        if area:
            qs = qs.filter(area__icontains=area.strip())

        sort = self.request.query_params.get("sort")
        if sort == "rating":
            qs = qs.order_by("-_avg_rating", "-created_at")
        else:
            qs = qs.order_by("-created_at")

        return qs.distinct()

    def list(self, request, *args, **kwargs):
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return success_response(data=serializer.data, count=len(serializer.data))