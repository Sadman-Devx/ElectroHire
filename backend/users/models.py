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
    One-time-password for email verification during signup.

    Field set: otp_code, email, expires_at (per the schedule), plus
    created_at + is_used — both devs independently landed on the same
    four extra fields, so no reconciliation was needed there.

    `generate_code()` / `create_for_email()` keep Dev 2's exact method
    names (his seed_test_otp management command calls
    `OTP.create_for_email(email)` directly), reimplemented with
    `secrets` instead of `random` — OTP generation is a security
    control, not a cosmetic feature — and with old-OTP invalidation
    added so a stale code can't be reused once a fresh one is issued.
    """

    email = models.EmailField(db_index=True)
    otp_code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["email", "is_used"]),
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
    def create_for_email(cls, email, ttl_minutes=None):
        ttl_minutes = ttl_minutes or getattr(settings, "OTP_EXPIRY_MINUTES", 5)

        # Invalidate any previous unused OTPs for this email first, so
        # there's never more than one *valid* code per email at a time.
        cls.objects.filter(email=email, is_used=False).update(is_used=True)

        return cls.objects.create(
            email=email,
            otp_code=cls.generate_code(),
            expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
        )

    def __str__(self):
        return f"{self.email} -> {self.otp_code}"