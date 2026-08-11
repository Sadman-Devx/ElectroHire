from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.response import error_response, first_error_message, success_response

from .models import Report
from .serializers import ReportCreateSerializer


# -- Dev 2, Day 8 ---------------------------------------------------------
class ReportCreateView(APIView):
    """
    POST /api/reports/

    Auth required. Bidirectional per the App Build doc's edge-case
    decision -- reported_type distinguishes a reported Provider from a
    reported User, both going through this one endpoint rather than two
    separate ones.

    Response is message-only per the Contract (no `data` block) --
    unlike RatingCreateView, there's nothing about the created Report
    the frontend needs back beyond confirmation.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ReportCreateSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=status.HTTP_400_BAD_REQUEST,
                errors=serializer.errors,
            )

        validated = serializer.validated_data
        Report.objects.create(
            reported_by=request.user,
            reported_id=validated["reported_id"],
            reported_type=validated["reported_type"],
            reason=validated["reason"],
            details=validated.get("details", ""),
        )

        return success_response(
            message="Report submitted. We will review within 24-48 hours.",
            status_code=status.HTTP_201_CREATED,
        )