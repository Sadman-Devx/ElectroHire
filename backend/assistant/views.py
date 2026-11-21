import logging

from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView

from core.response import error_response, first_error_message, success_response

from .analysis import analyze_problem
from .booking_draft import check_provider_bookable, draft_booking
from .llm_client import AIServiceError
from .matching import match_providers, unavailable_result
from .serializers import AnalyzeRequestSerializer, BookingDraftRequestSerializer

logger = logging.getLogger(__name__)

AI_UNAVAILABLE_MESSAGE = (
    "The AI assistant is having trouble right now. Please try again in a moment."
)


class AnalyzeProblemView(APIView):
    """
    POST /api/assistant/analyze/

    Auth required. Body: {"problem": "Ceiling fan ghure na",
                          "area": "Gulshan",                        # optional
                          "history": [{"problem": "...", "summary": "..."}]}  # optional (Phase 4C)

    history = earlier turns of this chat so follow-ups like "can it be
    cheaper?" are understood. Only the last 3 are used, trimmed. Held by
    the client: the server stores no conversation.

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
            "language": "bn|en",
            "sources": [{"title", "url", "domain"}],   # Phase 4B, [] if Tavily is off
            "providers": {                      # Phase 2
              "area": "Gulshan" | null,
              "area_matched": true | false | null,
              "matches": [ <same shape as GET /api/providers/> ],
              "message": "...",
              "alternatives": {"other_areas": [...providers...],
                               "other_categories": [{"id","name","provider_count"}]}
            }
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
        area = serializer.validated_data.get("area")
        history = serializer.validated_data.get("history") or []

        try:
            result = analyze_problem(problem, history=history)
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

        # Phase 2: attach real providers. The AI analysis already cost
        # money, so a matching failure must never throw it away.
        try:
            result["providers"] = match_providers(
                category=result["category"],
                category_fallback=result["category_fallback"],
                area=area,
                language=result["language"],
                request=request,
            )
        except Exception:
            logger.exception("Provider matching failed")
            result["providers"] = unavailable_result(result["language"])

        return success_response(message="Analysis complete", data=result)


class BookingDraftView(APIView):
    """
    POST /api/assistant/booking-draft/   (Phase 4A)

    Auth required. Body:
        {"provider_id": 7, "message": "kal shokal 10 tar, House 12 Road 5",
         "problem_summary": "...", "category_id": 1}   (last two optional)

    Returns a DRAFT only:
        {"provider": {"id", "name", "area"},
         "draft": {"provider_id", "category_id", "scheduled_date",
                   "scheduled_time", "address", "description"},
         "missing_fields": ["address"], "problems": {field: [msg]},
         "ready": false, "today": "YYYY-MM-DD", "language": "en"}

    SAFETY: this view NEVER creates a booking and has no code path that
    can. The customer reviews/edits the draft and presses Confirm in the
    UI, which calls the existing POST /api/bookings/ (same validation as
    any manual booking). Shares the "assistant" throttle bucket with
    /analyze/ because every draft is a billed AI call.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "assistant"

    def post(self, request):
        serializer = BookingDraftRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )
        data = serializer.validated_data

        # Existing booking rules for the provider/category, BEFORE we
        # spend an AI call (unknown / not-active provider, bad category).
        provider_errors = check_provider_bookable(data["provider_id"], data.get("category_id"))
        if provider_errors:
            return error_response(
                first_error_message(provider_errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=provider_errors,
            )

        try:
            result = draft_booking(
                provider_id=data["provider_id"],
                message=data["message"],
                problem_summary=data.get("problem_summary"),
                category_id=data.get("category_id"),
            )
        except AIServiceError:
            return error_response(
                AI_UNAVAILABLE_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            logger.exception("Unexpected error in booking draft")
            return error_response(
                AI_UNAVAILABLE_MESSAGE,
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return success_response(
            message="Draft ready. Nothing is booked until you confirm.", data=result
        )
