from rest_framework import serializers

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

    def validate_problem(self, value):
        cleaned = sanitize_user_text(value)
        if len(cleaned) < MIN_PROBLEM_LENGTH:
            raise serializers.ValidationError(
                f"Please describe your problem in at least {MIN_PROBLEM_LENGTH} characters."
            )
        return cleaned
