from django.utils import timezone
from rest_framework import serializers

from categories.models import Category
from providers.models import Provider

from .models import Booking


class BookingCreateSerializer(serializers.Serializer):
    """
    Validates the request body for POST /api/bookings/.
    Request shape:
        {"provider_id": 1, "category_id": 2, "scheduled_date": "2026-09-10",
         "scheduled_time": "14:30", "address": "House 12, Road 5, Dhanmondi",
         "description": "AC not cooling, need a checkup"}

    Only an *active* provider can be booked — same reasoning
    ContactCheckView/RatingCreateView already apply to their own
    provider lookups: a pending/rejected provider hasn't been vetted
    by admin yet and shouldn't be bookable from their (not-yet-public)
    detail page.

    scheduled_date/scheduled_time shape-validation only checks they're
    not in the past — deeper availability logic (e.g. a provider's own
    calendar) is out of scope for this MVP feature, same "keep the
    model a plain data record, keep business rules at the edges" split
    Rating/Report already use.
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
    Body: {"status": "confirmed"}

    Which transitions are actually allowed from the booking's *current*
    status, and who's allowed to make them (provider vs customer), is
    checked in BookingStatusUpdateView — this only validates that the
    submitted value is one of Booking's real status choices at all.
    """

    status = serializers.ChoiceField(choices=Booking.STATUS_CHOICES)


class BookingListItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/bookings/ (the customer's own
    bookings — "my bookings"). Includes the provider's name/photo so
    the frontend doesn't need a second lookup per row, same reasoning
    MyRatingListItemSerializer already documents for its own
    provider_name field.
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
    Shapes each item in GET /api/bookings/provider/ (the logged-in
    provider's incoming booking requests). Includes the customer's
    name/phone — the provider needs to know who to actually call/visit,
    same "who is this from" need ConversationListView already serves
    for chat threads.
    """

    customer_id = serializers.IntegerField(source="user.id")
    customer_name = serializers.CharField(source="user.name")
    customer_phone = serializers.CharField(source="user.phone")
    category_name = serializers.CharField(
        source="category.name", default=None, allow_null=True
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
            "created_at",
        ]


class BookingCreateResponseSerializer(serializers.ModelSerializer):
    """
    Shapes the `data` block of POST /api/bookings/'s 201 response —
    just enough for the frontend to show a confirmation without a
    second GET, same pattern ContactLogResponseSerializer already
    uses for POST /api/contacts/.
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