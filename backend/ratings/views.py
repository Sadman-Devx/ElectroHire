from django.db.models import Avg, Count
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView

from contacts.models import ContactLog
from core.response import error_response, first_error_message, success_response
from providers.models import Provider

from .models import Rating
from .serializers import (
    MyRatingListItemSerializer,
    ProviderRatingListItemSerializer,
    RatingCreateSerializer,
)


# -- Dev 2, Day 7 -------------------------------------------------------
class RatingCreateView(APIView):
    """
    POST /api/ratings/

    Auth required. A user may only rate a provider they have already
    contacted (App Build Step 8 / API Contract Section 5's documented
    error case) -- checked here against contacts.models.ContactLog before
    the Rating row is ever created.

    One rating per (user, provider): a repeat submission updates the
    existing row (rating_value/review_text/tags) instead of raising a
    duplicate error -- lets a user revise their opinion, and matches the
    "resubmit updates in place" behaviour ProviderProfileSetupSerializer
    already uses for provider profiles.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = RatingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )

        validated = serializer.validated_data
        provider_id = validated["provider_id"]

        provider = Provider.objects.get(id=provider_id)

        has_contacted = ContactLog.objects.filter(
            user=request.user, provider=provider
        ).exists()
        if not has_contacted:
            return error_response(
                "You must contact this provider before rating",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        Rating.objects.update_or_create(
            user=request.user,
            provider=provider,
            defaults={
                "rating_value": validated["rating_value"],
                "review_text": validated.get("review_text", ""),
                "tags": validated.get("tags", []),
            },
        )

        return success_response(
            message="Rating submitted", status_code=status.HTTP_201_CREATED
        )


# -- Dev 1, Day 9 -------------------------------------------------------
class MyRatingListView(APIView):
    """
    GET /api/ratings/mine/

    Not in the API Contract PDF — added to back the User Account Page's
    "My Ratings" section (Day 9 schedule, Dev 1). Every rating the
    authenticated user has submitted, newest first (Rating.Meta.ordering).

    Registered at "mine/" (not "/api/ratings/{provider_id}/" or similar)
    so it can never collide with a numeric provider-scoped route, and so
    it reads unambiguously as "the caller's own ratings" rather than a
    provider lookup.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        ratings = Rating.objects.filter(user=request.user).select_related(
            "provider", "provider__user"
        )
        data = MyRatingListItemSerializer(ratings, many=True).data
        return success_response(data=data, count=len(data))


# -- Dev 2, Day 7 -------------------------------------------------------
class ProviderRatingListView(APIView):
    """
    GET /api/providers/{id}/ratings/ -- public, no auth required.

    Response shape (per API Contract, Section 5):
        {"status": "success", "avg_rating": 4.8, "count": 24, "data": [...]}

    avg_rating/count are computed here via aggregate() rather than the
    provider.ratings.count() + a separate Avg() query, to keep this to a
    single DB round trip.
    """

    permission_classes = [AllowAny]

    def get(self, request, pk):
        try:
            provider = Provider.objects.get(pk=pk)
        except Provider.DoesNotExist:
            return error_response("Provider not found", status_code=status.HTTP_404_NOT_FOUND)

        ratings = Rating.objects.filter(provider=provider).select_related("user")
        aggregates = ratings.aggregate(avg=Avg("rating_value"), count=Count("id"))
        avg_rating = round(aggregates["avg"], 1) if aggregates["avg"] is not None else 0.0

        data = ProviderRatingListItemSerializer(ratings, many=True).data
        return success_response(
            data=data, avg_rating=avg_rating, count=aggregates["count"]
        )