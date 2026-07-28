from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from core.response import error_response, first_error_message, success_response

from .models import OTP, User
from .serializers import LoginSerializer, RegisterSerializer, VerifyOTPSerializer
from .utils import send_otp_email


# ── Dev 1, Day 2 ───────────────────────────────────────────────────
class RegisterView(APIView):
    """
    POST /api/auth/register/

    Creates the account (unverified, inactive) and emails a 6-digit OTP.
    Verification + JWT issuance is Dev 2's VerifyOTPView below.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=400,
                errors=serializer.errors,
            )

        user = serializer.save()

        otp = OTP.create_for_email(user.email)
        send_otp_email(user.email, otp.otp_code)

        return success_response(message="OTP sent to your email", status_code=201)


# ── Dev 2, Day 2 — logic unchanged from the original push, only the
#    hand-written Response(...) dicts were swapped for the shared
#    core.responses helpers (identical JSON output — see tests) ──────
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
            return error_response(
                "Invalid input", status_code=400, errors=serializer.errors
            )

        email = serializer.validated_data["email"].lower().strip()
        submitted_code = serializer.validated_data["otp"].strip()

        # সবচেয়ে সাম্প্রতিক, ব্যবহার না-হওয়া OTP খুঁজবে
        otp_entry = (
            OTP.objects.filter(email=email, is_used=False).order_by(
                "-created_at").first()
        )

        if otp_entry is None or otp_entry.otp_code != submitted_code:
            return error_response("Invalid or expired OTP", status_code=400)

        if otp_entry.is_expired():
            return error_response("Invalid or expired OTP", status_code=400)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return error_response(
                "No account found for this email", status_code=404
            )

        # OTP consume করো (একবারই ব্যবহার হবে) + user verify করো
        otp_entry.is_used = True
        otp_entry.save(update_fields=["is_used"])

        user.verified = True
        user.is_active = True
        user.save(update_fields=["verified", "is_active"])

        refresh = RefreshToken.for_user(user)

        return success_response(
            message="Account verified",
            data={
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "role": user.role,
            },
            status_code=200,
        )


# ── Dev 1, Day 3 ───────────────────────────────────────────────────
class LoginView(APIView):
    """
    POST /api/auth/login/
    Body: {"email": "...", "password": "..."}

    - email/password Check করে
    - Valid হলে JWT (access + refresh) Return করে, role + name সহ
      (per API Contract)
    - Invalid credentials হলে 400 + generic error (email vs password
      কোনটা ভুল সেটা আলাদা করে বলা হয় না, security best practice)
    - Account থাকলেও এখনো OTP verify না হলে 403 + specific message,
      যাতে ব্যবহারকারী বুঝতে পারে কী করতে হবে
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input", status_code=400, errors=serializer.errors
            )

        email = serializer.validated_data["email"].strip().lower()
        password = serializer.validated_data["password"]

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Deliberately the same message as a wrong password below —
            # don't leak whether the email itself exists.
            return error_response("Invalid email or password", status_code=400)

        if not user.check_password(password):
            return error_response("Invalid email or password", status_code=400)

        if not user.is_active or not user.verified:
            return error_response(
                "Please verify your email before logging in", status_code=403
            )

        refresh = RefreshToken.for_user(user)

        return success_response(
            data={
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "role": user.role,
                "name": user.name,
            },
            status_code=200,
        )