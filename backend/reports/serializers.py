from django.contrib.auth import get_user_model
from rest_framework import serializers

from providers.models import Provider

from .models import Report

User = get_user_model()


class ReportCreateSerializer(serializers.Serializer):
    """
    Validates the request body for POST /api/reports/.
    Request shape (per API Contract, Section 6):
        {"reported_id": 1, "reported_type": "provider",
         "reason": "fake", "details": "This person is not real..."}

    reported_id's existence is checked here against whichever table
    reported_type points at (User or Provider) -- same split as
    RatingCreateSerializer.validate_provider_id, just branching on a
    second field since this endpoint's target isn't fixed to one model.
    """

    reported_id = serializers.IntegerField()
    reported_type = serializers.ChoiceField(choices=Report.TYPE_CHOICES)
    reason = serializers.ChoiceField(choices=Report.REASON_CHOICES)
    details = serializers.CharField(
        max_length=2000, allow_blank=True, required=False, default=""
    )

    def validate(self, attrs):
        reported_type = attrs["reported_type"]
        reported_id = attrs["reported_id"]

        if reported_type == Report.TYPE_PROVIDER:
            exists = Provider.objects.filter(id=reported_id).exists()
            not_found_message = "Provider not found."
        else:
            exists = User.objects.filter(id=reported_id).exists()
            not_found_message = "User not found."

        if not exists:
            raise serializers.ValidationError({"reported_id": not_found_message})

        return attrs