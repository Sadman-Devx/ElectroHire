from django.db import models

# Create your models here.
import random
from datetime import timedelta

from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """Custom User model (Day 1 dependency — implemented here so
    Day 2 OTP Verify can actually run end-to-end for testing)."""

    ROLE_CHOICES = (
        ("user", "User"),
        ("provider", "Provider"),
    )

    name = models.CharField(max_length=150)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=20, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")
    verified = models.BooleanField(default=False)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return f"{self.email} ({self.role})"


class OTP(models.Model):
    """OTP model — API Contract-এর verify-otp endpoint-এর জন্য দরকার।
    (Dev 1 owns the Signup+Generate side on Day 2; this model is shared.)"""

    email = models.EmailField(db_index=True)
    otp_code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    def is_expired(self):
        return timezone.now() > self.expires_at

    @staticmethod
    def generate_code():
        return f"{random.randint(0, 999999):06d}"

    @classmethod
    def create_for_email(cls, email, ttl_minutes=5):
        return cls.objects.create(
            email=email,
            otp_code=cls.generate_code(),
            expires_at=timezone.now() + timedelta(minutes=ttl_minutes),
        )

    def __str__(self):
        return f"{self.email} -> {self.otp_code}"