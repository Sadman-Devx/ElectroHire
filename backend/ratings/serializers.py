from rest_framework import serializers

from providers.models import Provider

from .models import Rating

ALLOWED_TAGS = {"on_time", "professional", "good_work", "fair_price"}


class RatingCreateSerializer(serializers.Serializer):
    """
    Validates the request body for POST /api/ratings/.
    Request shape (per API Contract, Section 5):
        {"provider_id": 1, "rating_value": 4,
         "review_text": "Very professional!", "tags": ["on_time", "professional"]}

    Eligibility (does the caller have a ContactLog for this provider?) is
    checked in the view, not here -- same separation ProviderProfileSetupSerializer
    uses: this serializer only validates the *shape* of the request, not
    business rules that depend on `request.user`.
    """

    provider_id = serializers.IntegerField()
    rating_value = serializers.IntegerField(min_value=1, max_value=5)
    review_text = serializers.CharField(
        max_length=2000, allow_blank=True, required=False, default=""
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=30),
        required=False,
        default=list,
    )

    def validate_provider_id(self, value):
        if not Provider.objects.filter(id=value).exists():
            raise serializers.ValidationError("Provider not found.")
        return value

    def validate_tags(self, value):
        # Quick-tags list from Dev 3's Rating Submit Page (Day 8 schedule):
        # "On time, Professional, Good work, Fair price". Unknown tags are
        # dropped rather than rejected -- keeps this endpoint forward
        # compatible if the frontend adds a new quick-tag later without a
        # backend release blocking it.
        return [tag for tag in value if tag in ALLOWED_TAGS]


class MyRatingListItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/ratings/mine/ (Day 9, Dev 1 — not in
    the API Contract PDF; backs the User Account Page's "My Ratings"
    section).

    Same field set as ProviderRatingListItemSerializer plus
    provider_id/provider_name, since "my ratings" needs to say *which*
    provider each rating was for (the public per-provider list doesn't,
    since the provider is already fixed by the URL there).
    """

    provider_id = serializers.IntegerField(source="provider.id")
    provider_name = serializers.CharField(source="provider.user.name")
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = Rating
        fields = [
            "provider_id",
            "provider_name",
            "rating_value",
            "review_text",
            "tags",
            "created_at",
        ]

    def get_created_at(self, obj):
        from django.utils import timezone

        return timezone.localtime(obj.created_at).date().isoformat()


class ProviderRatingListItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/providers/{id}/ratings/.
    Response shape (per API Contract, Section 5):
        {"user_name": "Mahmudul", "rating_value": 5,
         "review_text": "Very professional!", "tags": ["on_time", "professional"],
         "created_at": "2025-01-15"}

    created_at is a date-only string per the contract example, same
    "DateTimeField column, DateField-shaped output" situation already
    solved for Provider.member_since -- reuse that SerializerMethodField
    fix here instead of DateField(source=...), which DRF cannot coerce
    from a DateTimeField automatically.
    """

    user_name = serializers.CharField(source="user.name", read_only=True)
    created_at = serializers.SerializerMethodField()

    class Meta:
        model = Rating
        fields = ["user_name", "rating_value", "review_text", "tags", "created_at"]

    def get_created_at(self, obj):
        from django.utils import timezone

        return timezone.localtime(obj.created_at).date().isoformat()