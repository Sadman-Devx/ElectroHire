from rest_framework import serializers

from django.core.exceptions import ValidationError as DjangoValidationError

from providers.models import Provider
from .models import ContactLog, Message
from .validators import (
    MAX_VOICE_SECONDS,
    TYPE_TEXT,
    TYPE_VOICE,
    clean_filename,
    resolve_message_type,
    validate_attachment,
)


class ContactCheckSerializer(serializers.Serializer):
    """
    Shapes the response for GET /api/contacts/check/{provider_id}/
    (Day 9, Dev 1 — not in the API Contract PDF; added to back the
    Rating button's enable/disable state on ProviderDetailPage).

    `has_contacted` is exactly the same boolean ratings/views.py's
    RatingCreateView already computes server-side before allowing a
    rating — exposed here as its own read as a GET, no side effects,
    so the frontend can decide *before* the user fills out the rating
    form whether to show it as enabled, rather than finding out only
    after a failed POST /api/ratings/.
    """

    has_contacted = serializers.BooleanField()
    provider_id = serializers.IntegerField()


class ContactHistoryItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/contacts/history/ (Day 9, Dev 1 — not
    in the API Contract PDF; backs the User Account Page's "Contact
    History" section).

    Field choices mirror ProviderListSerializer's public shape
    (providers/serializers.py) wherever the same data is already
    exposed elsewhere, so the frontend can reuse one ProviderCard-style
    render for both — just sourced from ContactLog -> provider instead
    of the public provider list.
    """

    provider_id = serializers.IntegerField(source="provider.id")
    provider_name = serializers.CharField(source="provider.user.name")
    provider_area = serializers.CharField(source="provider.area")
    provider_photo = serializers.SerializerMethodField()
    contacted_at = serializers.DateTimeField()

    class Meta:
        model = ContactLog
        fields = [
            "provider_id",
            "provider_name",
            "provider_area",
            "provider_photo",
            "contacted_at",
        ]

    def get_provider_photo(self, obj):
        photo = obj.provider.photo
        if not photo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(photo.url) if request else photo.url


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


def _attachment_url(message, request):
    """Absolute URL of a message's attachment, or None for plain text."""
    if not message.attachment:
        return None
    url = message.attachment.url
    return request.build_absolute_uri(url) if request else url


class MessageSendSerializer(serializers.Serializer):
    """
    Validates the request body for POST /api/contacts/messages/{provider_id}/.

    Two shapes are accepted (JSON for text, multipart/form-data for files):

      Text   (JSON):       { "content": "Kal sokal 9 tar dike ashun" }
      Attach (multipart):  attachment=<file>, message_type=image|file|voice,
                           content=<optional caption>,
                           duration_seconds=<voice only, optional>

    The text-only shape is exactly what the API Contract (Section 4)
    documents, so existing clients keep working unchanged.
    """

    content = serializers.CharField(
        max_length=2000, required=False, allow_blank=True, trim_whitespace=True
    )
    message_type = serializers.ChoiceField(
        choices=["text", "image", "file", "voice"], required=False
    )
    attachment = serializers.FileField(
        required=False, allow_null=True, allow_empty_file=False, max_length=255
    )
    duration_seconds = serializers.IntegerField(
        required=False, allow_null=True, min_value=0, max_value=MAX_VOICE_SECONDS
    )

    def validate(self, attrs):
        content = (attrs.get("content") or "").strip()
        attachment = attrs.get("attachment")
        hint = attrs.get("message_type")

        if attachment is None:
            if hint not in (None, TYPE_TEXT):
                raise serializers.ValidationError(
                    "An attachment is required for this message type."
                )
            if not content:
                raise serializers.ValidationError("Message content cannot be empty.")
            attrs["content"] = content
            attrs["message_type"] = TYPE_TEXT
            return attrs

        message_type = resolve_message_type(attachment.name, hint)
        try:
            mime = validate_attachment(attachment, message_type)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.messages[0])

        attrs["message_type"] = message_type
        # A voice note carries no caption; photos/files may have one.
        attrs["content"] = "" if message_type == TYPE_VOICE else content
        attrs["attachment_name"] = clean_filename(attachment.name)
        attrs["attachment_size"] = attachment.size
        attrs["attachment_mime"] = mime
        attrs["duration_seconds"] = (
            attrs.get("duration_seconds") if message_type == TYPE_VOICE else None
        )
        return attrs


class MessageListItemSerializer(serializers.ModelSerializer):
    """
    Shapes each item in GET /api/contacts/messages/{provider_id}/.
    Response shape (per API Contract, Section 4, plus attachment fields):
        { "id": 1, "sender_id": 5, "sender_name": "Mahmudul",
          "content": "...", "created_at": "...", "is_read": true,
          "message_type": "text", "attachment_url": null,
          "attachment_name": "", "attachment_size": 0,
          "attachment_mime": "", "duration_seconds": null }

    Pass `context={"request": request}` so attachment_url is absolute.
    """

    sender_id = serializers.IntegerField(source="sender.id")
    sender_name = serializers.CharField(source="sender.name")
    attachment_url = serializers.SerializerMethodField()

    def get_attachment_url(self, obj):
        return _attachment_url(obj, self.context.get("request"))

    class Meta:
        model = Message
        fields = [
            "id",
            "sender_id",
            "sender_name",
            "content",
            "created_at",
            "is_read",
            "message_type",
            "attachment_url",
            "attachment_name",
            "attachment_size",
            "attachment_mime",
            "duration_seconds",
        ]


class MessageCreateResponseSerializer(serializers.ModelSerializer):
    """
    Shapes the response for POST /api/contacts/messages/{provider_id}/.
    Response shape (per API Contract, Section 4, plus attachment fields):
        { "id": 3, "content": "...", "created_at": "...",
          "message_type": "image", "attachment_url": "...", ... }

    `preview` is the one-line summary the conversation list shows as the
    "last message" ("📷 Photo", "🎤 Voice message", or the text itself).
    """

    preview = serializers.CharField(read_only=True)
    attachment_url = serializers.SerializerMethodField()

    def get_attachment_url(self, obj):
        return _attachment_url(obj, self.context.get("request"))

    class Meta:
        model = Message
        fields = [
            "id",
            "content",
            "created_at",
            "message_type",
            "attachment_url",
            "attachment_name",
            "attachment_size",
            "attachment_mime",
            "duration_seconds",
            "preview",
        ]


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