from django.db.models import Avg
from django.utils import timezone
from rest_framework import serializers

from categories.models import Category

from .models import Provider, ProviderCategory


class ProviderProfileSetupSerializer(serializers.Serializer):
    """
    Backs POST /api/providers/profile/ (Dev 2, Day 4)

    Request (per API Contract):
        {"categories": [1, 2], "area": "...", "experience": 8,
         "description": "...", "photo": <file>}

    Auth required (JWT). Creates or updates the *caller's own*
    Provider row (one-to-one with the authenticated user) and resets
    status back to "pending" on every write — a provider editing an
    already-approved profile should go through admin review again,
    same as a first-time submission.
    """

    categories = serializers.ListField(
        child=serializers.IntegerField(), allow_empty=False
    )
    area = serializers.CharField(max_length=100)
    experience = serializers.IntegerField(min_value=0)
    description = serializers.CharField(allow_blank=True, required=False, default="")
    photo = serializers.ImageField(required=False, allow_null=True)

    def validate_categories(self, value):
        existing_ids = set(
            Category.objects.filter(id__in=value).values_list("id", flat=True)
        )
        missing = [cid for cid in value if cid not in existing_ids]
        if missing:
            raise serializers.ValidationError(f"Invalid category id(s): {missing}")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        validated = self.validated_data

        provider, _ = Provider.objects.update_or_create(
            user=user,
            defaults={
                "area": validated["area"],
                "experience": validated["experience"],
                "description": validated.get("description", ""),
                # Every write (create or edit) goes back to pending
                # for re-review — see docstring above.
                "status": "pending",
            },
        )

        photo = validated.get("photo")
        if photo is not None:
            provider.photo = photo
            provider.save(update_fields=["photo"])

        # Replace category links with exactly what was submitted this time.
        ProviderCategory.objects.filter(provider=provider).delete()
        ProviderCategory.objects.bulk_create(
            [
                ProviderCategory(provider=provider, category_id=cid)
                for cid in validated["categories"]
            ]
        )

        return provider


class ProviderDetailSerializer(serializers.ModelSerializer):
    """
    Backs GET /api/providers/{id}/ (Dev 2, Day 4) — public, no auth.

    member_since is exposed as a plain "YYYY-MM-DD" string even though
    Provider.created_at is a DateTimeField column. DRF will NOT
    auto-coerce a DateTimeField into a DateField serializer field, so
    this uses a SerializerMethodField with an explicit
    django.utils.timezone conversion — the same fix pattern already
    used for the equivalent member_since bug elsewhere in the project.

    avg_rating / review_count now come from a live aggregate over the
    Rating model (Day 7, Dev 2) instead of the earlier hardcoded 0 / 0.0
    placeholders — field names were already contract-correct, so this is
    the only change needed here.
    """

    name = serializers.CharField(source="user.name", read_only=True)
    categories = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()
    member_since = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()

    class Meta:
        model = Provider
        fields = [
            "id",
            "name",
            "area",
            "experience",
            "description",
            "photo",
            "categories",
            "avg_rating",
            "review_count",
            "member_since",
        ]

    def get_categories(self, obj):
        return list(obj.categories.values_list("name", flat=True))

    def get_photo(self, obj):
        if not obj.photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_avg_rating(self, obj):
        avg = obj.ratings.aggregate(avg=Avg("rating_value"))["avg"]
        return round(avg, 1) if avg is not None else 0.0

    def get_review_count(self, obj):
        return obj.ratings.count()

    def get_member_since(self, obj):
        local_dt = timezone.localtime(obj.created_at)
        return local_dt.date().isoformat()


# ── Dev 1, Day 4 ─────────────────────────────────────────────────────
class ProviderListSerializer(serializers.ModelSerializer):
    """
    Backs GET /api/providers/ (Dev 1, Day 4) — public, no auth.

    Shape matches the API Contract exactly:
        {"id", "name", "area", "experience", "photo", "categories",
         "avg_rating", "review_count", "status"}

    avg_rating / review_count are annotated onto the queryset in
    ProviderListView.get_queryset (Day 7, Dev 2) rather than recomputed
    per-row here, so this just reads the annotated attributes straight
    off each Provider instance — cheaper than N+1 aggregate queries.
    """

    name = serializers.CharField(source="user.name", read_only=True)
    categories = serializers.SerializerMethodField()
    photo = serializers.SerializerMethodField()
    avg_rating = serializers.SerializerMethodField()
    review_count = serializers.SerializerMethodField()

    class Meta:
        model = Provider
        fields = [
            "id",
            "name",
            "area",
            "experience",
            "photo",
            "categories",
            "avg_rating",
            "review_count",
            "status",
        ]

    def get_categories(self, obj):
        return list(obj.categories.values_list("name", flat=True))

    def get_photo(self, obj):
        if not obj.photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url

    def get_avg_rating(self, obj):
        # Populated via .annotate(_avg_rating=Avg(...)) in
        # ProviderListView.get_queryset; falls back to 0.0 for any
        # provider with no ratings (Avg() returns None there, and for
        # safety if this serializer is ever used without the annotation).
        avg = getattr(obj, "_avg_rating", None)
        return round(avg, 1) if avg is not None else 0.0

    def get_review_count(self, obj):
        return getattr(obj, "_review_count", 0) or 0