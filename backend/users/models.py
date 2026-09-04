import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

from .managers import UserManager


class User(AbstractUser):
    """
    Custom user model.

    Merged from two independent Day 1/Day 2 implementations:
    - `username` is removed (Dev 1's approach) — users log in with
      `email` only (see Login API, Day 3), which needed a custom
      UserManager (managers.py) since Django's default one requires
      a username.
    - Field set (name, email, phone, role, verified) matches what both
      devs already agreed on.
    """

    ROLE_USER = "user"
    ROLE_PROVIDER = "provider"
    ROLE_ADMIN = "admin"
    ROLE_CHOICES = (
        (ROLE_USER, "User"),
        (ROLE_PROVIDER, "Provider"),
        (ROLE_ADMIN, "Admin"),
    )

    username = None  # replaced by email as the login identifier
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, unique=True, blank=True, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default=ROLE_USER)
    verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["name"]

    objects = UserManager()

    def __str__(self):
        return f"{self.email} ({self.role})"


class OTP(models.Model):
    """
    One-time-password for email verification during signup, and (added
    for the Forgot/Reset Password feature) for password-reset requests.

    Field set: otp_code, email, expires_at (per the schedule), plus
    created_at + is_used — both devs independently landed on the same
    four extra fields, so no reconciliation was needed there.

    `generate_code()` / `create_for_email()` keep Dev 2's exact method
    names (his seed_test_otp management command calls
    `OTP.create_for_email(email)` directly), reimplemented with
    `secrets` instead of `random` — OTP generation is a security
    control, not a cosmetic feature — and with old-OTP invalidation
    added so a stale code can't be reused once a fresh one is issued.

    `purpose` (added alongside Forgot/Reset Password): the signup-verify
    flow (VerifyOTPView) and the password-reset flow (ResetPasswordView)
    now both create OTP rows against the same email, and a code issued
    for one purpose must never verify the other -- e.g. a signup OTP a
    user never used should not be usable to reset their password later.
    Kept as a field on this same model rather than a second table
    because every other field (email, otp_code, expires_at, is_used)
    is identical between the two flows; only which purpose a given code
    is valid for differs. Defaults to PURPOSE_SIGNUP so the pre-existing
    seed_test_otp command and any already-issued rows keep working
    unchanged.
    """

    PURPOSE_SIGNUP = "signup"
    PURPOSE_PASSWORD_RESET = "password_reset"
    PURPOSE_CHOICES = (
        (PURPOSE_SIGNUP, "Signup Verification"),
        (PURPOSE_PASSWORD_RESET, "Password Reset"),
    )

    email = models.EmailField(db_index=True)
    otp_code = models.CharField(max_length=6)
    purpose = models.CharField(
        max_length=20, choices=PURPOSE_CHOICES, default=PURPOSE_SIGNUP
    )
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            # Name matches the auto-generated name Django already picked
            # in migrations/0002 (users_otp_email_9b592c_idx) — kept
            # verbatim (not renamed to an explicit name) so this edit
            # doesn't require a spurious rename-index migration op.
            models.Index(fields=["email", "is_used"], name="users_otp_email_9b592c_idx"),
            models.Index(
                fields=["email", "purpose", "is_used"],
                name="users_otp_email_purpose_idx",
            ),
        ]

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired()

    @staticmethod
    def generate_code(length=None):
        length = length or getattr(settings, "OTP_LENGTH", 6)
        return "".join(str(secrets.randbelow(10)) for _ in range(length))

    @classmethod
    def create_for_email(cls, email, ttl_minutes=None, purpose=PURPOSE_SIGNUP):
        ttl_minutes = ttl_minutes or getattr(settings, "OTP_EXPIRY_MINUTES", 5)

        # Invalidate any previous unused OTPs for this email *and this
        # purpose* first, so there's never more than one valid code per
        # (email, purpose) pair at a time. Scoped by purpose (not just
        # email) so requesting a password-reset code doesn't silently
        # burn a still-valid signup-verification code the user hasn't
        # used yet, and vice versa.
        cls.objects.filter(email=email, purpose=purpose, is_used=False).update(
            is_used=True
        )

        return cls.objects.create(
            email=email,
            otp_code=cls.generate_code(),
            purpose=purpose,
            expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
        )

    def __str__(self):
        return f"{self.email} -> {self.otp_code} ({self.purpose})"