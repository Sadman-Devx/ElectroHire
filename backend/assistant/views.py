import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from core.response import error_response, first_error_message, success_response

from .analysis import analyze_problem
from .llm_client import AIServiceError
from .serializers import AnalyzeRequestSerializer

logger = logging.getLogger(__name__)

AI_UNAVAILABLE_MESSAGE = (
    "The AI assistant is having trouble right now. Please try again in a moment."
)


class AnalyzeProblemView(APIView):
    """
    POST /api/assistant/analyze/

    Auth required. Body: {"problem": "Ceiling fan ghure na"}

    Success (200):
        {
          "status": "success",
          "message": "Analysis complete",
          "data": {
            "category": {"id": 1, "name": "Electrician"} | null,
            "category_fallback": false,
            "urgency": "low|medium|high|emergency",
            "summary": "...",
            "safety_tips": ["...", "..."],
            "cost_estimate": {"min": 300, "max": 800, "currency": "BDT",
                              "disclaimer": "..."} | null,
            "language": "bn|en"
          }
        }

    Errors follow the project-wide {"status": "error", "message": "..."}
    contract: 400 invalid input, 401 not logged in, 429 rate limited,
    503 AI unavailable / unusable reply (never a 500 crash).

    throttle_scope="assistant" is a tighter per-user ceiling on top of
    the project-wide anon/user limits (same pattern as users/views.py)
    because every call costs real money and is an abuse target.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "assistant"

    def post(self, request):
        serializer = AnalyzeRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )

        problem = serializer.validated_data["problem"]

        try:
            result = analyze_problem(problem)
        except AIServiceError:
            # Details were already logged where the failure happened;
            # the user only ever sees a polite, generic message.
            return error_response(
                AI_UNAVAILABLE_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            logger.exception("Unexpected error in assistant analysis")
            return error_response(
                AI_UNAVAILABLE_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return success_response(message="Analysis complete", data=result)
