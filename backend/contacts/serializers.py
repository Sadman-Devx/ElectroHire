from rest_framework import serializers

from providers.models import Provider
from .models import ContactLog, Message


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


class MessageSendSerializer(serializers.Serializer):
    """
    Validates the request body for POST /api/contacts/messages/{provider_id}/.
    Request shape (per API Contract, Section 4):
        { "content": "Kal sokal 9 tar dike ashun" }
    """

    content = serializers.CharField(max_length=2000, trim_whitespace=True)

    def validate_content(self, value):
        if not value.strip():
            raise serializers.ValidationError("Message content cannot be empty.")
        return value


class MessageListItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/contacts/messages/{provider_id}/.
    Response shape (per API Contract, Section 4):
        { "id": 1, "sender_id": 5, "sender_name": "Mahmudul",
          "content": "...", "created_at": "...", "is_read": true }
    """

    sender_id = serializers.IntegerField(source="sender.id")
    sender_name = serializers.CharField(source="sender.name")

    class Meta:
        model = Message
        fields = ["id", "sender_id", "sender_name", "content", "created_at", "is_read"]


class MessageCreateResponseSerializer(serializers.ModelSerializer):
    """
    Shapes the response for POST /api/contacts/messages/{provider_id}/.
    Response shape (per API Contract, Section 4):
        { "id": 3, "content": "...", "created_at": "..." }
    """

    class Meta:
        model = Message
        fields = ["id", "content", "created_at"]


class ConversationSerializer(serializers.Serializer):
    """
    Shapes each item in GET /api/contacts/conversations/ (not in the API
    Contract PDF — designed to match the schedule's "last message + unread
    count" requirement and Dev 3's Chat Page conversation list).

    `provider_id` is included (and, for this MVP, always present — see
    ConversationListView) so the frontend can route straight into
    GET/POST /api/contacts/messages/{provider_id}/ for that thread without
    a second lookup.
    """

    provider_id = serializers.IntegerField(allow_null=True)
    other_user_id = serializers.IntegerField()
    other_user_name = serializers.CharField()
    other_user_role = serializers.CharField()
    last_message = serializers.CharField(allow_blank=True)
    last_message_at = serializers.DateTimeField(allow_null=True)
    unread_count = serializers.IntegerField()