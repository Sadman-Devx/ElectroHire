from rest_framework import serializers

from providers.models import Provider
from .models import ContactLog


class ContactCreateSerializer(serializers.Serializer):
    """
    Validates the incoming request body for POST /api/contacts/.
    Request shape (per API Contract, Section 4):
        { "provider_id": 1 }
    """

    provider_id = serializers.IntegerField()

    def validate_provider_id(self, value):
        if not Provider.objects.filter(id=value).exists():
            raise serializers.ValidationError("Provider not found.")
        return value


class ContactLogResponseSerializer(serializers.ModelSerializer):
    """
    Shapes the response for POST /api/contacts/.
    Response shape (per API Contract, Section 4):
        { "contact_id": 15, "provider_name": "Karim Uddin" }

    ASSUMPTION: provider display name comes from provider.user.name.
    Change to provider.name if your Provider model stores name directly.
    """

    contact_id = serializers.IntegerField(source="id")
    provider_name = serializers.SerializerMethodField()

    class Meta:
        model = ContactLog
        fields = ["contact_id", "provider_name"]

    def get_provider_name(self, obj):
        return obj.provider.user.name