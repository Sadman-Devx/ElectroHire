from rest_framework import serializers

from .matching import MAX_AREA_LENGTH, clean_area
from .prompts import sanitize_user_text

MIN_PROBLEM_LENGTH = 5
MAX_PROBLEM_LENGTH = 1000


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

    def validate_area(self, value):
        return clean_area(value)

    def validate_problem(self, value):
        cleaned = sanitize_user_text(value)
        if len(cleaned) < MIN_PROBLEM_LENGTH:
            raise serializers.ValidationError(
                f"Please describe your problem in at least {MIN_PROBLEM_LENGTH} characters."
            )
        return cleaned