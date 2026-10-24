from rest_framework import serializers

from .matching import MAX_AREA_LENGTH, clean_area
from .prompts import sanitize_user_text

MIN_PROBLEM_LENGTH = 5
MAX_PROBLEM_LENGTH = 1000


MAX_HISTORY_ITEMS = 20  # sanity cap on the payload; only the last 3 are ever used


class HistoryTurnSerializer(serializers.Serializer):
    """One earlier exchange of the conversation (Phase 4C)."""

    problem = serializers.CharField(
        trim_whitespace=True, max_length=MAX_PROBLEM_LENGTH,
        error_messages={
            "required": "Each history item needs the earlier problem text.",
            "blank": "Each history item needs the earlier problem text.",
            "null": "Each history item needs the earlier problem text.",
            "invalid": "History problem must be text.",
            "max_length": "A history item is too long.",
        },
    )
    summary = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=1000,
        error_messages={"invalid": "History summary must be text.", "max_length": "A history item is too long."},
    )


class AnalyzeRequestSerializer(serializers.Serializer):
    problem = serializers.CharField(
        trim_whitespace=True,
        allow_blank=False,
        min_length=MIN_PROBLEM_LENGTH,
        max_length=MAX_PROBLEM_LENGTH,
        error_messages={
            "required": "Please describe your problem.",
            "blank": "Please describe your problem.",
            "null": "Please describe your problem.",
            "invalid": "Problem must be text.",
            "min_length": f"Please describe your problem in at least {MIN_PROBLEM_LENGTH} characters.",
            "max_length": f"Problem description is too long (max {MAX_PROBLEM_LENGTH} characters).",
        },
    )

    # Optional. The User model has no stored area, so the frontend
    # passes the area the person typed/picked. Only used to filter
    # providers in the database; it is never sent to the AI.
    area = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        max_length=MAX_AREA_LENGTH,
        error_messages={
            "invalid": "Area must be text.",
            "max_length": f"Area is too long (max {MAX_AREA_LENGTH} characters).",
        },
    )

    # Optional, Phase 4C: earlier turns so follow-ups ("can it be cheaper?")
    # make sense. Held by the client; the server stores nothing.
    history = HistoryTurnSerializer(
        many=True, required=False, allow_null=True, max_length=MAX_HISTORY_ITEMS
    )

    def validate_history(self, value):
        return value or []

    def validate_area(self, value):
        return clean_area(value)

    def validate_problem(self, value):
        cleaned = sanitize_user_text(value)
        if len(cleaned) < MIN_PROBLEM_LENGTH:
            raise serializers.ValidationError(
                f"Please describe your problem in at least {MIN_PROBLEM_LENGTH} characters."
            )
        return cleaned


class BookingDraftRequestSerializer(serializers.Serializer):
    """
    Body for POST /api/assistant/booking-draft/. The provider is chosen
    by the customer in the UI (a provider card) and sent as provider_id;
    the AI never decides who is booked.
    """

    provider_id = serializers.IntegerField(
        min_value=1,
        error_messages={
            "required": "Please choose a provider.",
            "invalid": "Provider id must be a number.",
            "min_value": "Please choose a provider.",
        },
    )
    message = serializers.CharField(
        trim_whitespace=True,
        allow_blank=False,
        min_length=3,
        max_length=500,
        error_messages={
            "required": "Please tell me when and where you want the booking.",
            "blank": "Please tell me when and where you want the booking.",
            "null": "Please tell me when and where you want the booking.",
            "invalid": "Message must be text.",
            "min_length": "Please tell me when and where you want the booking.",
            "max_length": "Message is too long (max 500 characters).",
        },
    )
    # From the Phase 1 analysis (optional): becomes the booking's notes.
    problem_summary = serializers.CharField(
        required=False, allow_blank=True, allow_null=True, max_length=400
    )
    category_id = serializers.IntegerField(required=False, allow_null=True, min_value=1)

    def validate_message(self, value):
        cleaned = sanitize_user_text(value)
        if len(cleaned) < 3:
            raise serializers.ValidationError(
                "Please tell me when and where you want the booking."
            )
        return cleaned
