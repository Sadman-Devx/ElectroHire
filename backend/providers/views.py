from django.db.models import Avg, Count, Q
from rest_framework.generics import ListAPIView
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from contacts.models import ContactLog, Message
from contacts.serializers import MessageListItemSerializer
from core.response import error_response, first_error_message, success_response
from ratings.models import Rating
from ratings.serializers import ProviderRatingListItemSerializer

from .models import Provider
from .serializers import (
    ProviderDetailSerializer,
    ProviderListSerializer,
    ProviderMeSerializer,
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


# ── Dev 3, Day 9 ─────────────────────────────────────────────────────
class ProviderMeView(APIView):
    """
    GET /api/providers/me/

    Not in the API Contract PDF — added to back the Provider Profile
    Edit Page (Day 9 schedule, Dev 3: "Provider Profile Edit Page ...
    Category Edit (Multiple), Area, Experience Edit ... Verified/Active
    Badge দেখাবে"). The edit form needs the caller's *real* current
    values to pre-fill itself — categories, area, experience,
    description, photo — plus status and verified so the page can show
    an honest badge instead of inventing one.

    Auth required. Always the *authenticated user's own* provider row
    — no id in the URL, same "no id, it's always the caller" shape
    ProviderDashboardView (below) and users.MeView already use. Same
    reasoning too for the 403 when there's no Provider row yet: the
    caller is authenticated fine, they just don't have a profile to
    edit yet (they haven't completed POST /api/providers/profile/),
    which is exactly the case ProviderDashboardView already treats as
    403 rather than 404 for the same underlying "no Provider row"
    condition — kept consistent here on purpose.

    Registered as a literal "me/" segment ahead of "<int:pk>/" in
    urls.py, same reasoning already documented there for "dashboard/".
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider = (
            Provider.objects.select_related("user")
            .prefetch_related("categories")
            .filter(user=request.user)
            .first()
        )
        if provider is None:
            return error_response(
                "You haven't set up a provider profile yet.", status_code=403
            )

        serializer = ProviderMeSerializer(provider, context={"request": request})
        return success_response(data=serializer.data)


# ── Dev 2, Day 9 ─────────────────────────────────────────────────────
class ProviderDashboardView(APIView):
    """
    GET /api/providers/dashboard/

    Not in the API Contract PDF — added to back Dev 3's Provider
    Dashboard page (Day 6 schedule: Stats Cards + Recent Messages
    Preview Section; Day 9 schedule, Dev 2: "Provider Dashboard API —
    GET /api/providers/dashboard/ ... Stats: contacts_count,
    ratings_count, avg_rating ... Recent Messages Preview (Last 3) ...
    Recent Reviews (Last 3)").

    Auth required. Always the *authenticated provider's own* dashboard
    — no provider_id in the URL or query string, same "no id, it's
    always the caller" shape GET /api/ratings/mine/ already uses (Dev 1,
    Day 9). A caller with no Provider profile of their own gets a 403,
    not a 404 — they're authenticated fine, they just don't have a
    dashboard to see.

    Registered as a literal "dashboard/" segment ahead of
    "<int:pk>/" in urls.py (same reasoning contacts/urls.py already
    documents for its literal-before-variable routes) so it can never
    be swallowed by the provider-detail route.

    recent_messages / recent_reviews deliberately reuse
    contacts.serializers.MessageListItemSerializer and
    ratings.serializers.ProviderRatingListItemSerializer — the exact
    shapes those two lists already return elsewhere (a message thread /
    a provider's public ratings list) — instead of inventing a third
    shape for the same data, so the frontend can reuse whatever
    components already render those two lists.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider = Provider.objects.filter(user=request.user).first()
        if provider is None:
            return error_response(
                "Only providers have a dashboard.", status_code=403
            )

        contacts_count = ContactLog.objects.filter(provider=provider).count()

        rating_aggregates = Rating.objects.filter(provider=provider).aggregate(
            avg=Avg("rating_value"), count=Count("id")
        )
        ratings_count = rating_aggregates["count"] or 0
        avg_rating = (
            round(rating_aggregates["avg"], 1)
            if rating_aggregates["avg"] is not None
            else 0.0
        )

        # A provider's own user account can appear as either party on a
        # Message row (customer -> provider, or provider replying), so
        # both sides are pulled here — same sender-or-receiver shape
        # ConversationListView (contacts/views.py) already uses for its
        # own "which threads is this user part of" lookup.
        recent_messages = (
            Message.objects.filter(Q(sender=request.user) | Q(receiver=request.user))
            .select_related("sender")
            .order_by("-created_at")[:3]
        )

        recent_reviews = (
            Rating.objects.filter(provider=provider)
            .select_related("user")
            .order_by("-created_at")[:3]
        )

        data = {
            "contacts_count": contacts_count,
            "ratings_count": ratings_count,
            "avg_rating": avg_rating,
            "recent_messages": MessageListItemSerializer(
                recent_messages, many=True
            ).data,
            "recent_reviews": ProviderRatingListItemSerializer(
                recent_reviews, many=True
            ).data,
        }
        return success_response(data=data)


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