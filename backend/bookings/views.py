from django.db import transaction
from django.db.models import Sum
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from categories.models import Category
from core.response import error_response, first_error_message, success_response
from providers.models import Provider
from wallet.services import get_wallet_summary, post_completion_ledger

from .commission import (
    COMMISSION_UPDATE_FIELDS,
    apply_completion,
    apply_quote,
    is_provider_blocked,
    money_str,
    outstanding_for_provider,
    void_commission,
)
from .models import Booking
from .serializers import (
    BookingCreateResponseSerializer,
    BookingCreateSerializer,
    BookingListItemSerializer,
    BookingStatusUpdateSerializer,
    ProviderBookingListItemSerializer,
    ProviderStatusUpdateResponseSerializer,
)

# Which status a booking may move *to*, keyed by who's making the
# request and what the booking's *current* status is. One explicit table
# so the full lifecycle is visible in one place.
_PROVIDER_TRANSITIONS = {
    Booking.STATUS_PENDING: {Booking.STATUS_CONFIRMED, Booking.STATUS_REJECTED},
    Booking.STATUS_CONFIRMED: {Booking.STATUS_COMPLETED},
}
_CUSTOMER_TRANSITIONS = {
    Booking.STATUS_PENDING: {Booking.STATUS_CANCELLED},
    Booking.STATUS_CONFIRMED: {Booking.STATUS_CANCELLED},
}


class BookingCreateView(APIView):
    """
    POST /api/bookings/

    Auth required. Any authenticated user can request a booking with an
    active provider for a given date/time. Deliberately does NOT require
    a prior ContactLog — booking is itself a form of first contact.
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


class BookingListView(APIView):
    """
    GET /api/bookings/mine/

    "My bookings" — every booking the authenticated user has made as a
    customer. Shows the provider's quote as the final price; never any
    commission data.
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


class ProviderBookingListView(APIView):
    """
    GET /api/bookings/provider/

    The logged-in provider's own incoming booking requests, including
    quote / commission / net-earning fields. 404s for a caller with no
    provider profile (the "you're not a provider" signal).
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


class ProviderCommissionSummaryView(APIView):
    """
    GET /api/bookings/provider/commission/

    The provider's commission position at a glance, read from their
    wallet (the `wallet` app is the single source of truth): the current
    rate, how much they owe the platform right now, whether that has
    reached the block threshold, how much commission has already been
    cleared, their available balance, and the jobs that make up the due.

    Registered at a literal path ahead of "<int:pk>/status/" in urls.py.
    The full statement lives at GET /api/wallet/ and /api/wallet/transactions/.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        provider = getattr(request.user, "provider_profile", None)
        if provider is None:
            return error_response(
                "You do not have a provider profile", status_code=status.HTTP_404_NOT_FOUND
            )

        wallet = get_wallet_summary(provider)
        paid_total = (
            Booking.objects.filter(
                provider=provider,
                commission_status__in=[
                    Booking.COMMISSION_DUE,
                    Booking.COMMISSION_PAID,
                    Booking.COMMISSION_DEDUCTED,
                ],
            ).aggregate(total=Sum("commission_settled_amount"))["total"]
            or 0
        )

        due_bookings = (
            Booking.objects.filter(
                provider=provider, commission_status=Booking.COMMISSION_DUE
            )
            .select_related("user", "category")
            .order_by("completed_at", "id")[:50]
        )

        data = {
            "rate_percent": wallet["rate_percent"],
            "outstanding": wallet["due_amount"],
            "block_threshold": wallet["block_threshold"],
            "is_blocked": wallet["is_blocked"],
            "total_paid": money_str(paid_total),
            "balance": wallet["balance"],
            "available_balance": wallet["available_balance"],
            "due_bookings": ProviderBookingListItemSerializer(
                due_bookings, many=True
            ).data,
        }
        return success_response(data=data)


class BookingStatusUpdateView(APIView):
    """
    PATCH /api/bookings/{id}/status/

    Moves a booking to a new status; who may make which move is in
    _PROVIDER_TRANSITIONS / _CUSTOMER_TRANSITIONS above. The commission
    bookkeeping rides on those same transitions:

      provider confirms   -> quoted_price REQUIRED; rate + commission are
                             locked in; commission_status "pending".
                             Refused (403) while the provider's unpaid
                             commission is at/over the block threshold.
      provider completes  -> cash job: commission is debited from the
                             provider's wallet (shows as "due" unless
                             their balance already covers it); online
                             job: price - commission is credited and
                             clears any due. See wallet/services.py.
      provider rejects /
      customer cancels    -> commission voided (nothing was earned).

    The row is locked (select_for_update) for the whole change so two
    simultaneous requests can't both pass the transition check.
    """

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        serializer = BookingStatusUpdateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )

        new_status = serializer.validated_data["status"]
        quoted_price = serializer.validated_data.get("quoted_price")

        with transaction.atomic():
            try:
                booking = Booking.objects.select_for_update().get(pk=pk)
            except Booking.DoesNotExist:
                return error_response(
                    "Booking not found", status_code=status.HTTP_404_NOT_FOUND
                )

            provider = Provider.objects.get(pk=booking.provider_id)
            is_provider_side = provider.user_id == request.user.id
            is_customer_side = booking.user_id == request.user.id

            if is_provider_side:
                allowed = _PROVIDER_TRANSITIONS.get(booking.status, set())
            elif is_customer_side:
                allowed = _CUSTOMER_TRANSITIONS.get(booking.status, set())
            else:
                return error_response(
                    "You are not part of this booking",
                    status_code=status.HTTP_403_FORBIDDEN,
                )

            if new_status not in allowed:
                return error_response(
                    f"Cannot change status from '{booking.status}' to '{new_status}'",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            if is_provider_side:
                if new_status == Booking.STATUS_CONFIRMED:
                    if quoted_price is None:
                        return error_response(
                            "Enter your price (the total the customer will pay) to confirm this booking.",
                            status_code=status.HTTP_400_BAD_REQUEST,
                        )
                    if is_provider_blocked(provider):
                        owed = money_str(outstanding_for_provider(provider))
                        return error_response(
                            f"You have {owed} in unpaid platform commission. "
                            "Please pay your dues to accept new bookings.",
                            status_code=status.HTTP_403_FORBIDDEN,
                        )
                    apply_quote(booking, quoted_price)
                elif new_status == Booking.STATUS_COMPLETED:
                    apply_completion(booking)
                    # Ledger: cash job -> commission debited from the
                    # provider's wallet; online job -> earning credited
                    # (clearing any due first). Same transaction as the
                    # status change, so they succeed or fail together.
                    post_completion_ledger(booking)
                elif new_status == Booking.STATUS_REJECTED:
                    void_commission(booking)
            else:
                # Customer cancelling: whatever was quoted earns nothing.
                void_commission(booking)

            booking.status = new_status
            booking.save(update_fields=["status", "updated_at", *COMMISSION_UPDATE_FIELDS])

        if is_provider_side:
            data = ProviderStatusUpdateResponseSerializer(booking).data
        else:
            data = {"id": booking.id, "status": booking.status}

        return success_response(
            message=f"Booking marked as {new_status}",
            data=data,
        )