from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.response import error_response, first_error_message, success_response

from .models import OTP, User
from .utils import send_otp_email, send_password_reset_email
from .serializers import (
    AccountDeleteSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    RefreshSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    ResetPasswordSerializer,
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

        otp = OTP.create_for_email(user.email, purpose=OTP.PURPOSE_SIGNUP)
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

        # সবচেয়ে সাম্প্রতিক, ব্যবহার না-হওয়া OTP খুঁজবে — purpose="signup"
        # দিয়ে filter করা, যাতে কোনো password-reset OTP দিয়ে account
        # verify করা না যায় (Day 11, Dev 2: OTP.purpose যোগ হওয়ার পরে)।
        otp_entry = (
            OTP.objects.filter(
                email=email, purpose=OTP.PURPOSE_SIGNUP, is_used=False
            ).order_by("-created_at").first()
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

        otp = OTP.create_for_email(user.email, purpose=OTP.PURPOSE_SIGNUP)
        send_otp_email(user.email, otp.otp_code)

        return success_response(message="A new OTP has been sent to your email")


# ── Dev 2, Day 11 ────────────────────────────────────────────────────
class ForgotPasswordView(APIView):
    """
    POST /api/auth/forgot-password/
    Body: {"email": "..."}

    Not in the API Contract PDF — new feature. Generates a 6-digit OTP
    (purpose="password_reset", separate from the signup-verify OTP —
    see OTP.purpose) and emails it, same delivery mechanism
    send_otp_email already uses for signup.

    Always returns the same generic success message whether or not the
    account exists — same "don't confirm/deny an email is registered"
    reasoning ResendOTPView already documents for its own identical
    situation. Only a *verified* account can actually receive a code:
    an unverified signup has no real password to protect yet, and
    letting this endpoint also work for it would let someone silently
    "verify" a signup-in-progress via the reset flow instead of OTP
    verify, bypassing RegisterView's intended path.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input", status_code=400, errors=serializer.errors
            )

        email = serializer.validated_data["email"].strip().lower()
        generic_message = "If an account exists for this email, a password reset code has been sent"

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return success_response(message=generic_message)

        if not user.verified:
            return success_response(message=generic_message)

        otp = OTP.create_for_email(user.email, purpose=OTP.PURPOSE_PASSWORD_RESET)
        send_password_reset_email(user.email, otp.otp_code)

        return success_response(message=generic_message)


# ── Dev 2, Day 11 ────────────────────────────────────────────────────
class ResetPasswordView(APIView):
    """
    POST /api/auth/reset-password/
    Body: {"email": "...", "otp": "123456", "new_password": "..."}

    Not in the API Contract PDF — new feature. Mirrors VerifyOTPView's
    OTP-lookup shape (most recent unused code for this email, purpose
    scoped) but purpose="password_reset" instead of "signup", and ends
    in user.set_password(...) instead of issuing JWTs.

    Deliberately does NOT log the user in afterwards (no access/refresh
    token in the response) — the frontend sends them to /login with
    their new password, same as any fresh credential change should
    require re-authenticating rather than trusting the just-used OTP
    as an implicit login.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=400,
                errors=serializer.errors,
            )

        email = serializer.validated_data["email"].strip().lower()
        submitted_code = serializer.validated_data["otp"].strip()
        new_password = serializer.validated_data["new_password"]

        otp_entry = (
            OTP.objects.filter(
                email=email, purpose=OTP.PURPOSE_PASSWORD_RESET, is_used=False
            ).order_by("-created_at").first()
        )

        if otp_entry is None or otp_entry.otp_code != submitted_code:
            return error_response("Invalid or expired OTP", status_code=400)

        if otp_entry.is_expired():
            return error_response("Invalid or expired OTP", status_code=400)

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return error_response("No account found for this email", status_code=404)

        otp_entry.is_used = True
        otp_entry.save(update_fields=["is_used"])

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return success_response(message="Password has been reset. Please log in.")


# ── Dev 2, Day 11 ────────────────────────────────────────────────────
class AccountDeleteView(APIView):
    """
    DELETE /api/auth/account/
    Body: {"password": "..."}

    Not in the API Contract PDF — new feature. Auth required; always
    deletes the *caller's own* account, same "no id parameter" safety
    property MeView already documents, so this can never be pointed at
    someone else's account.

    Requires the current password as re-confirmation (see
    AccountDeleteSerializer's docstring). On success, user.delete()
    cascades through every FK this project defines with
    on_delete=CASCADE (Provider via OneToOneField, ContactLog, Message,
    Rating, Report, and — once added — Booking), so no orphaned rows
    are left behind; nothing here needs to clean those up manually.

    No refresh-token blacklist step: this project has no token_blacklist
    app installed (see RefreshTokenView's docstring), and once the user
    row is gone, SimpleJWT's own JWTAuthentication.get_user() fails to
    resolve the token's user id and rejects any further request with
    that access token anyway — the same natural consequence deleting a
    user always has here, not something this view needs to special-case.
    """

    permission_classes = [IsAuthenticated]

    def delete(self, request):
        serializer = AccountDeleteSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                "Invalid input", status_code=400, errors=serializer.errors
            )

        password = serializer.validated_data["password"]
        if not request.user.check_password(password):
            return error_response("Incorrect password", status_code=400)

        request.user.delete()
        return success_response(message="Account deleted")


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