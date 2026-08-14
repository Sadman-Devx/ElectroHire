from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.response import error_response, first_error_message, success_response

from .models import OTP, User
from .utils import send_otp_email
from .serializers import (
    LoginSerializer,
    RefreshSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    UserPublicSerializer,
    VerifyOTPSerializer,
)


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


# ── Dev 2, Day 2 ─────────────────────────────────────────────────────
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


# ── Dev 3, Day 3 ───────────────────────────────────────────────────
class ResendOTPView(APIView):
    """
    POST /api/auth/resend-otp/
    Body: {"email": "..."}

    OTP verify পেজের "Resend" বাটনের জন্য। নতুন 6-digit OTP জেনারেট করে
    email করে দেয়।
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input", status_code=400, errors=serializer.errors
            )

        email = serializer.validated_data["email"].strip().lower()

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            # Same response shape whether or not the account exists —
            # don't let this endpoint confirm/deny an email is registered.
            return success_response(message="If an account exists, a new code has been sent")

        if user.verified:
            return error_response(
                "This account is already verified. Please log in.", status_code=400
            )

        otp = OTP.create_for_email(user.email)
        send_otp_email(user.email, otp.otp_code)

        return success_response(message="A new OTP has been sent to your email")


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


# ── Dev 1, Day 9 ───────────────────────────────────────────────────
class RefreshTokenView(APIView):
    """
    POST /api/auth/refresh/

    Not in the API Contract PDF — added per the Day 9 schedule's "JWT
    Token Refresh Logic বানাও" task. SIMPLE_JWT.ACCESS_TOKEN_LIFETIME is
    only 30 minutes (settings.py), and until this endpoint existed
    there was no way for the frontend to get a new access token short
    of forcing the user to log in again every 30 minutes.

    Body: {"refresh_token": "..."}
    Response (success): {"status": "success", "data": {"access_token": "..."}}
    Response (error, expired/invalid/blacklisted token): 401

    Deliberately does NOT rotate the refresh token (no
    ROTATE_REFRESH_TOKENS in SIMPLE_JWT, no token_blacklist app
    installed) — the same refresh token keeps working until its own
    7-day REFRESH_TOKEN_LIFETIME expires, at which point the user is
    sent back to /login the same as any other invalid-token case.
    Rotation is a reasonable V2 hardening step, not required for this
    MVP's threat model.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RefreshSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors), status_code=400
            )

        try:
            refresh = RefreshToken(serializer.validated_data["refresh_token"])
            access_token = str(refresh.access_token)
        except TokenError:
            return error_response(
                "Invalid or expired refresh token. Please log in again.",
                status_code=401,
            )

        return success_response(data={"access_token": access_token}, status_code=200)


# ── Dev 1, Day 9 ───────────────────────────────────────────────────
class MeView(APIView):
    """
    GET /api/auth/me/

    Not in the API Contract PDF — added to back the User Account
    Page's "Profile Info" section (Day 9 schedule, Dev 1). Auth
    required; always returns the *caller's own* record — there is no
    id parameter, deliberately, so this can never be used to look up
    another account.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = UserPublicSerializer(request.user).data
        return success_response(data=data)