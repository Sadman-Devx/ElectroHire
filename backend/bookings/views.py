from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from categories.models import Category
from core.response import error_response, first_error_message, success_response
from providers.models import Provider

from .models import Booking
from .serializers import (
    BookingCreateResponseSerializer,
    BookingCreateSerializer,
    BookingListItemSerializer,
    BookingStatusUpdateSerializer,
    ProviderBookingListItemSerializer,
)

# Which status a booking may move *to*, keyed by who's making the
# request and what the booking's *current* status is. Kept as one
# explicit table (not scattered if/elif chains) so the full lifecycle
# is visible in one place — same reasoning Booking.STATUS_CHOICES'
# docstring lays out the intended one-way flow for.
_PROVIDER_TRANSITIONS = {
    Booking.STATUS_PENDING: {Booking.STATUS_CONFIRMED, Booking.STATUS_REJECTED},
    Booking.STATUS_CONFIRMED: {Booking.STATUS_COMPLETED},
}
_CUSTOMER_TRANSITIONS = {
    Booking.STATUS_PENDING: {Booking.STATUS_CANCELLED},
    Booking.STATUS_CONFIRMED: {Booking.STATUS_CANCELLED},
}


# ── Dev 2, Day 11 ────────────────────────────────────────────────────
class BookingCreateView(APIView):
    """
    POST /api/bookings/

    New feature (Provider Booking System), not in the API Contract PDF.
    Auth required. Any authenticated user (customer or provider — a
    provider account can also book another provider, same as this
    project already lets anyone with an account contact/rate any
    provider; role is not restricted here) can request a booking with
    an active provider for a given date/time.

    Deliberately does NOT require a prior ContactLog the way
    RatingCreateView requires one for eligibility — booking is itself a
    form of first contact, not a follow-up action gated on one.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = BookingCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )

        validated = serializer.validated_data
        provider = Provider.objects.select_related("user").get(
            id=validated["provider_id"]
        )
        category = None
        if validated.get("category_id"):
            category = Category.objects.get(id=validated["category_id"])

        booking = Booking.objects.create(
            user=request.user,
            provider=provider,
            category=category,
            scheduled_date=validated["scheduled_date"],
            scheduled_time=validated["scheduled_time"],
            address=validated["address"],
            description=validated.get("description", ""),
        )

        data = BookingCreateResponseSerializer(booking).data
        return success_response(
            data=data,
            message="Booking request sent",
            status_code=status.HTTP_201_CREATED,
        )


# ── Dev 2, Day 11 ────────────────────────────────────────────────────
class BookingListView(APIView):
    """
    GET /api/bookings/

    "My bookings" — every booking the authenticated user has made as a
    customer, newest-scheduled first (Booking.Meta.ordering).
    select_related keeps this to one query regardless of how many
    bookings are returned, same reasoning ContactHistoryView already
    documents for its own listing.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        bookings = Booking.objects.filter(user=request.user).select_related(
            "provider", "provider__user", "category"
        )
        data = BookingListItemSerializer(
            bookings, many=True, context={"request": request}
        ).data
        return success_response(data=data, count=len(data))


# ── Dev 2, Day 11 ────────────────────────────────────────────────────
class ProviderBookingListView(APIView):
    """
    GET /api/bookings/provider/

    The logged-in provider's own incoming booking requests. Registered
    at a literal "provider/" path — ahead of "<int:pk>/status/" in
    urls.py — for the same top-to-bottom resolution reason
    providers/urls.py already documents for "dashboard/" and "me/".

    404s (not an empty list) for a caller with no provider profile at
    all, same "you're not a provider" signal ProviderMeView already
    uses, rather than silently returning an empty booking list that
    could be mistaken for "you have zero bookings".
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider = getattr(request.user, "provider_profile", None)
        if provider is None:
            return error_response(
                "You do not have a provider profile", status_code=status.HTTP_404_NOT_FOUND
            )

        bookings = Booking.objects.filter(provider=provider).select_related(
            "user", "category"
        )
        data = ProviderBookingListItemSerializer(bookings, many=True).data
        return success_response(data=data, count=len(data))


# ── Dev 2, Day 11 ────────────────────────────────────────────────────
class BookingStatusUpdateView(APIView):
    """
    PATCH /api/bookings/{id}/status/

    Moves a booking to a new status. Who's allowed to make which move
    depends on whether the caller is the booking's provider or its
    customer (see _PROVIDER_TRANSITIONS / _CUSTOMER_TRANSITIONS above):
      - The provider can confirm or reject a pending request, and mark
        a confirmed booking completed.
      - The customer can cancel their own booking while it's still
        pending or confirmed.
    Any other combination (e.g. a stranger, or the provider trying to
    cancel, or completing a still-pending booking) is rejected —
    mirrors the "no id parameter, always the caller's own record"
    safety property MeView/ProviderMeView already establish, just
    branched two ways instead of one since a booking has two parties.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        try:
            booking = Booking.objects.select_related(
                "provider", "provider__user", "user"
            ).get(pk=pk)
        except Booking.DoesNotExist:
            return error_response("Booking not found", status_code=status.HTTP_404_NOT_FOUND)

        serializer = BookingStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )

        new_status = serializer.validated_data["status"]
        is_provider_side = booking.provider.user_id == request.user.id
        is_customer_side = booking.user_id == request.user.id

        if is_provider_side:
            allowed = _PROVIDER_TRANSITIONS.get(booking.status, set())
        elif is_customer_side:
            allowed = _CUSTOMER_TRANSITIONS.get(booking.status, set())
        else:
            return error_response(
                "You are not part of this booking", status_code=status.HTTP_403_FORBIDDEN
            )

        if new_status not in allowed:
            return error_response(
                f"Cannot change status from '{booking.status}' to '{new_status}'",
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        booking.status = new_status
        booking.save(update_fields=["status", "updated_at"])

        return success_response(
            message=f"Booking marked as {new_status}",
            data={"id": booking.id, "status": booking.status},
        )