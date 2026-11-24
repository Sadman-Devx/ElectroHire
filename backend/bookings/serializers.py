from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from categories.models import Category
from contacts.masking import mask_contact_info
from providers.models import Provider

from .models import Booking

# Sanity bounds for a provider's quote (BDT). Not a business rule about
# what a fair price is -- just stops typos like an extra five zeros.
MIN_QUOTED_PRICE = Decimal("1")
MAX_QUOTED_PRICE = Decimal("1000000")


class BookingCreateSerializer(serializers.Serializer):
    """
    Validates the request body for POST /api/bookings/.
    Request shape:
        {"provider_id": 1, "category_id": 2, "scheduled_date": "2026-09-10",
         "scheduled_time": "14:30", "address": "House 12, Road 5, Dhanmondi",
         "description": "AC not cooling, need a checkup"}

    Only an *active* provider can be booked. scheduled_date/time are only
    checked for not being in the past.

    `description` is free text the provider reads before confirming, so
    phone numbers / e-mails / messenger links in it are hidden, same as
    in chat (contacts/masking.py) -- otherwise it would be an easy
    side door around the platform.
    """

    provider_id = serializers.IntegerField()
    category_id = serializers.IntegerField(required=False, allow_null=True)
    scheduled_date = serializers.DateField()
    scheduled_time = serializers.TimeField()
    address = serializers.CharField(max_length=255)
    description = serializers.CharField(
        max_length=2000, allow_blank=True, required=False, default=""
    )

    def validate_provider_id(self, value):
        provider = Provider.objects.filter(id=value).first()
        if provider is None:
            raise serializers.ValidationError("Provider not found.")
        if provider.status != "active":
            raise serializers.ValidationError(
                "This provider is not currently accepting bookings."
            )
        return value

    def validate_category_id(self, value):
        if value is None:
            return value
        if not Category.objects.filter(id=value).exists():
            raise serializers.ValidationError("Category not found.")
        return value

    def validate_description(self, value):
        masked, _was_masked = mask_contact_info(value)
        return masked

    def validate(self, attrs):
        scheduled_date = attrs.get("scheduled_date")
        scheduled_time = attrs.get("scheduled_time")

        if scheduled_date and scheduled_date < timezone.localdate():
            raise serializers.ValidationError(
                {"scheduled_date": "Scheduled date cannot be in the past."}
            )

        if (
            scheduled_date == timezone.localdate()
            and scheduled_time
            and scheduled_time < timezone.localtime().time()
        ):
            raise serializers.ValidationError(
                {"scheduled_time": "Scheduled time cannot be in the past."}
            )

        return attrs


class BookingStatusUpdateSerializer(serializers.Serializer):
    """
    Validates the request body for PATCH /api/bookings/{id}/status/.
    Body: {"status": "confirmed", "quoted_price": "1500.00"}

    `quoted_price` is only meaningful when the PROVIDER confirms a
    booking (it is required then -- enforced in BookingStatusUpdateView,
    which knows who is calling) and is ignored for every other
    transition. There is deliberately NO payment_method field: a
    provider must not be able to claim "paid online" to dodge the
    commission; cash is the only method a provider can report.

    Which transitions are allowed, and for whom, is checked in
    BookingStatusUpdateView.
    """

    status = serializers.ChoiceField(choices=Booking.STATUS_CHOICES)
    quoted_price = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=MIN_QUOTED_PRICE,
        max_value=MAX_QUOTED_PRICE,
        required=False,
    )


class BookingListItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/bookings/mine/ (the CUSTOMER's view).

    `quoted_price` is the final total the customer pays -- the provider's
    commission is taken from the provider's side, so no commission field
    is ever exposed here.
    """

    provider_id = serializers.IntegerField(source="provider.id")
    provider_name = serializers.CharField(source="provider.user.name")
    provider_photo = serializers.SerializerMethodField()
    category_name = serializers.CharField(
        source="category.name", default=None, allow_null=True
    )

    class Meta:
        model = Booking
        fields = [
            "id",
            "provider_id",
            "provider_name",
            "provider_photo",
            "category_name",
            "scheduled_date",
            "scheduled_time",
            "address",
            "description",
            "status",
            "quoted_price",
            "created_at",
        ]

    def get_provider_photo(self, obj):
        if not obj.provider.photo:
            return None
        request = self.context.get("request")
        url = obj.provider.photo.url
        return request.build_absolute_uri(url) if request else url


class ProviderBookingListItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/bookings/provider/ (the PROVIDER's view).
    Includes the customer's name/phone plus the full money picture:
    quote, commission rate/amount, what the provider keeps, and where the
    commission stands.
    """

    customer_id = serializers.IntegerField(source="user.id")
    customer_name = serializers.CharField(source="user.name")
    customer_phone = serializers.CharField(source="user.phone")
    category_name = serializers.CharField(
        source="category.name", default=None, allow_null=True
    )
    provider_net_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = Booking
        fields = [
            "id",
            "customer_id",
            "customer_name",
            "customer_phone",
            "category_name",
            "scheduled_date",
            "scheduled_time",
            "address",
            "description",
            "status",
            "quoted_price",
            "commission_rate",
            "commission_amount",
            "provider_net_amount",
            "commission_status",
            "payment_method",
            "completed_at",
            "created_at",
        ]


class ProviderStatusUpdateResponseSerializer(serializers.ModelSerializer):
    """
    `data` block of PATCH /api/bookings/{id}/status/ when the caller is
    the PROVIDER: the new status plus the money fields the transition
    just set, so the page can update the card without a refetch.
    (The customer's response only ever contains id + status.)
    """

    provider_net_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = Booking
        fields = [
            "id",
            "status",
            "quoted_price",
            "commission_rate",
            "commission_amount",
            "provider_net_amount",
            "commission_status",
            "payment_method",
            "completed_at",
        ]


class BookingCreateResponseSerializer(serializers.ModelSerializer):
    """
    Shapes the `data` block of POST /api/bookings/'s 201 response —
    just enough for the frontend to show a confirmation without a
    second GET.
    """

    provider_name = serializers.CharField(source="provider.user.name")

    class Meta:
        model = Booking
        fields = [
            "id",
            "provider_name",
            "scheduled_date",
            "scheduled_time",
            "status",
        ]