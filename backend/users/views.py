from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle, UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.response import error_response, first_error_message, success_response

from .models import OTP, User
from .utils import send_otp_email, send_password_reset_email
from .serializers import (
    AccountDeleteSerializer,
    ChangePasswordSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    RefreshSerializer,
    RegisterSerializer,
    ResendOTPSerializer,
    ResetPasswordSerializer,
    UserPublicSerializer,
    VerifyOTPSerializer,
)


# ── Day 1, Dev 1 ───────────────────────────────────────────────────
class RegisterView(APIView):
    """
    POST /api/auth/register/

    Creates the account (unverified, inactive) and emails a 6-digit OTP.
    Verification + JWT issuance is Dev 2's VerifyOTPView below.

    Security hardening (Day 13 audit):
    - throttle_scope="register": previously unlimited — a bot could
      script thousands of fake signups per minute, each one emailing
      a real OTP out (mail-bombing an unrelated inbox if the attacker
      controls the `email` field freely, which registration always
      lets them).
    - No longer lets a signup attempt double as an email-enumeration
      oracle: registering with an email that already belongs to a
      *verified* account used to return a distinguishable "Email
      already exists" 400 (see the old RegisterSerializer.
      validate_email) — now returns the exact same generic 201 success
      a real new signup gets, without creating a second row or
      emailing a real OTP to somebody else's inbox. Same
      "don't confirm/deny an account exists" reasoning
      ForgotPasswordView/ResendOTPView already apply to their own
      endpoints (see ForgotPasswordSerializer's docstring) — this just
      extends it to the one endpoint that hadn't gotten it yet.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "register"

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=400,
                errors=serializer.errors,
            )

        email = serializer.validated_data["email"]
        generic_message = "OTP sent to your email"

        # See this view's own docstring above for why this deliberately
        # returns the *same* success response instead of a distinguishable
        # error — checked here (not in the serializer) for the same
        # "existence checks belong in the view, not the serializer" split
        # ForgotPasswordSerializer's own docstring documents.
        if User.objects.filter(email__iexact=email, verified=True).exists():
            return success_response(message=generic_message, status_code=201)

        user = serializer.save()

        otp = OTP.create_for_email(user.email, purpose=OTP.PURPOSE_SIGNUP)
        send_otp_email(user.email, otp.otp_code)

        return success_response(message=generic_message, status_code=201)


# ── Dev 2, Day 2 ─────────────────────────────────────────────────────
class VerifyOTPView(APIView):
    """
    POST /api/auth/verify-otp/
    Body: {"email": "...", "otp": "123456"}

    - OTP Check করে, Expired কিনা দেখে
    - Valid হলে user.verified = True করে, JWT (access + refresh) Return করে
    - Invalid/Expired হলে 400 + error message Return করে

    Security hardening (Day 13 audit): throttle_scope="otp" — a
    6-digit code is only 1,000,000 possibilities; with no rate limit
    at all, brute-forcing one within its 5-minute expiry window
    (OTP_EXPIRY_MINUTES) was practical, not just theoretical. See
    settings.py's own comment on THROTTLE_RATES for the exact numbers.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "otp"

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

    Security hardening (Day 13 audit): throttle_scope="otp" — without
    this, "Resend" could be spammed to mail-bomb any inbox (the
    generic-response branch below still runs the throttle check first,
    since ScopedRateThrottle is IP-keyed, not existence-keyed).
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "otp"

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

    Security hardening (Day 13 audit): throttle_scope="password_reset"
    — previously unlimited, so this doubled as a mail-bomb vector (an
    attacker who doesn't even know if the address is registered could
    still trigger unlimited emails to it) exactly like ResendOTPView's
    own equivalent gap.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "password_reset"

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

    Security hardening (Day 13 audit): throttle_scope="otp" — same
    6-digit-guessable-code reasoning VerifyOTPView's own docstring
    explains, just for the password-reset OTP instead of the
    signup-verify one.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "otp"

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

    Security hardening (Day 13 audit): throttle_scope="password_reset"
    — this endpoint is already IsAuthenticated (so DEFAULT_THROTTLE_
    RATES['user'] alone covers casual abuse), but the tighter scoped
    rate additionally guards the password-guessing angle specifically:
    a stolen/leaked access token holder could otherwise brute-force the
    real password with as many attempts as the generous default 'user'
    rate allows before giving up and just calling it "confirmed".
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "password_reset"

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


# ── Day 12 ───────────────────────────────────────────────────────────
class ChangePasswordView(APIView):
    """
    POST /api/auth/change-password/
    Body: {"current_password": "...", "new_password": "..."}

    Not in the API Contract PDF — new feature. Auth required. This is
    the "I know my password and just want to update it" counterpart to
    Forgot/Reset Password's "I don't know my password anymore" flow —
    the two intentionally don't share a serializer/view despite both
    ending in user.set_password(), because they authenticate the
    request completely differently: this one via an already-valid JWT
    plus the current password, Forgot/Reset Password via a one-time
    emailed OTP instead. Two different starting situations (signed in
    vs. locked out) need two different proofs of identity.

    Requires the current password as re-confirmation, same
    "prove you're really you" reasoning AccountDeleteSerializer already
    documents — a JWT alone (stolen/leaked token, shared/forgotten-open
    session) shouldn't be enough to change the one credential that
    would lock the real account owner out. Also rejects submitting the
    same password as both current and new — not a security issue by
    itself, but silently doing nothing while returning "success" would
    be misleading, so this is caught explicitly with its own message.

    Deliberately does NOT log the user out / rotate or blacklist their
    existing JWTs afterwards (no token_blacklist app installed — see
    RefreshTokenView's docstring for the same project-wide limitation).
    The current access token keeps working until it naturally expires
    (30 minutes — see settings.py ACCESS_TOKEN_LIFETIME), same as
    ResetPasswordView leaves any tokens issued before a reset alone —
    changing your password while signed in shouldn't sign you out of
    your own current session.

    Security hardening (Day 13 audit): throttle_scope="password_reset"
    — same current-password-brute-force reasoning AccountDeleteView's
    own docstring just explained for its own password re-confirmation.
    """

    permission_classes = [IsAuthenticated]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "password_reset"

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return error_response(
                first_error_message(serializer.errors),
                status_code=400,
                errors=serializer.errors,
            )

        current_password = serializer.validated_data["current_password"]
        new_password = serializer.validated_data["new_password"]

        if not request.user.check_password(current_password):
            return error_response("Current password is incorrect", status_code=400)

        if current_password == new_password:
            return error_response(
                "New password must be different from your current password",
                status_code=400,
            )

        request.user.set_password(new_password)
        request.user.save(update_fields=["password"])

        return success_response(message="Password changed successfully")


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

    Security hardening (Day 13 audit): throttle_scope="login" —
    previously unlimited, meaning a script could try passwords against
    a known email as fast as the network allowed. 10/min is generous
    enough for a real person mistyping their password a few times, far
    too slow to make guessing a real password practical.
    """

    permission_classes = [AllowAny]
    throttle_classes = [ScopedRateThrottle, AnonRateThrottle, UserRateThrottle]
    throttle_scope = "login"

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