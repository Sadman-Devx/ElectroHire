from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import OTP, User
from .serializers import VerifyOTPSerializer


class VerifyOTPView(APIView):
    """
    POST /api/auth/verify-otp/
    Body: {"email": "...", "otp": "123456"}

    - OTP Check করে, Expired কিনা দেখে
    - Valid হলে user.verified = True করে, JWT (access + refresh) Return করে
    - Invalid/Expired হলে 400 + error message Return করে
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerifyOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {"status": "error", "message": "Invalid input", "errors": serializer.errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = serializer.validated_data["email"].lower().strip()
        submitted_code = serializer.validated_data["otp"].strip()

        # সবচেয়ে সাম্প্রতিক, ব্যবহার না-হওয়া OTP খুঁজবে
        otp_entry = (
            OTP.objects.filter(email=email, is_used=False).order_by("-created_at").first()
        )

        if otp_entry is None or otp_entry.otp_code != submitted_code:
            return Response(
                {"status": "error", "message": "Invalid or expired OTP"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp_entry.is_expired():
            return Response(
                {"status": "error", "message": "Invalid or expired OTP"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {"status": "error", "message": "No account found for this email"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # OTP consume করো (একবারই ব্যবহার হবে) + user verify করো
        otp_entry.is_used = True
        otp_entry.save(update_fields=["is_used"])

        user.verified = True
        user.is_active = True
        user.save(update_fields=["verified", "is_active"])

        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "status": "success",
                "message": "Account verified",
                "data": {
                    "access_token": str(refresh.access_token),
                    "refresh_token": str(refresh),
                    "role": user.role,
                },
            },
            status=status.HTTP_200_OK,
        )