import re

from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User

# Bangladeshi mobile numbers: 01[3-9]xxxxxxxx (11 digits total).
# ElectroHire targets BD users/providers (see design doc: Dhanmondi,
# Mirpur, Gulshan areas), so we validate against that format rather
# than accepting anything.
PHONE_REGEX = re.compile(r"^01[3-9]\d{8}$")


class RegisterSerializer(serializers.ModelSerializer):
    """
    Backs POST /api/auth/register/  (Dev 1, Day 2)

    Request (per API Contract):
        {"name": "...", "email": "...", "phone": "...",
         "password": "...", "role": "user" | "provider"}
    """

    # email/phone are declared explicitly (rather than left to
    # ModelSerializer's auto-generation) so DRF does NOT attach its
    # automatic UniqueValidator to them. That validator would run
    # before our validate_email()/validate_phone() below, produce a
    # generic Django message instead of the contract's exact wording,
    # and — worse — block the "resume an unverified signup" retry flow
    # since it can't distinguish a verified account from an unverified one.
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=20)
    password = serializers.CharField(write_only=True, min_length=8, max_length=128)
    role = serializers.ChoiceField(choices=[User.ROLE_USER, User.ROLE_PROVIDER])

    class Meta:
        model = User
        fields = ["name", "email", "phone", "password", "role"]

    # ── Field-level validation ────────────────────────────────
    def validate_name(self, value):
        value = value.strip()
        if len(value) < 2:
            raise serializers.ValidationError("Name must be at least 2 characters long")
        return value

    def validate_email(self, value):
        value = value.strip().lower()
        existing = User.objects.filter(email__iexact=value).first()
        if existing and existing.verified:
            # Matches the API Contract's documented error exactly.
            raise serializers.ValidationError("Email already exists")
        return value

    def validate_phone(self, value):
        if not value:
            raise serializers.ValidationError("Phone number is required")
        value = value.strip()
        if not PHONE_REGEX.match(value):
            raise serializers.ValidationError(
                "Enter a valid Bangladeshi mobile number, e.g. 01712345678"
            )
        email = (self.initial_data.get("email") or "").strip().lower()
        existing = User.objects.filter(phone=value).exclude(email__iexact=email).first()
        if existing:
            raise serializers.ValidationError("Phone number already in use")
        return value

    def validate_password(self, value):
        # Runs Django's configured AUTH_PASSWORD_VALIDATORS (min length,
        # not-too-common, not-all-numeric, not too similar to name/email).
        validate_password(value)
        return value

    # ── Create (or resume an unverified signup) ──────────────
    def create(self, validated_data):
        email = validated_data["email"]
        password = validated_data.pop("password")

        # A user may have started signup before and never verified the
        # OTP (closed the tab, OTP expired, etc). Rather than blocking
        # them with "Email already exists" forever, let them retry —
        # validate_email() above already refused if the account is
        # verified, so reaching here means it's safe to reuse the row.
        existing_unverified = User.objects.filter(
            email__iexact=email, verified=False
        ).first()

        if existing_unverified:
            existing_unverified.name = validated_data["name"]
            existing_unverified.phone = validated_data.get("phone")
            existing_unverified.role = validated_data["role"]
            existing_unverified.set_password(password)
            existing_unverified.save()
            return existing_unverified

        # is_active=False until OTP verification (Dev 2's verify-otp
        # flips this to True on success — see views.VerifyOTPView).
        # His own seed_test_otp command already assumed this same
        # is_active=False-until-verified convention, so this lines up
        # with what verify-otp already expects.
        return User.objects.create_user(password=password, is_active=False, **validated_data)


# ── Dev 2, Day 2 — unchanged ──────────────────────────────────────
class VerifyOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(max_length=6, min_length=6)


# ── Dev 1, Day 3 ───────────────────────────────────────────────────
class LoginSerializer(serializers.Serializer):
    """
    Backs POST /api/auth/login/ (per API Contract).

    Only shape-validates the input (well-formed email, password
    present). The actual credential/verified-status check happens in
    LoginView, since that needs DB access and distinguishing
    "wrong credentials" from "not verified yet" — not something a
    serializer alone can decide.
    """

    email = serializers.EmailField()
    # trim_whitespace=False: a password's exact character content
    # matters, unlike the other trimmed fields on this form.
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class UserPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "name", "email", "phone", "role", "verified"]

class ResendOTPSerializer(serializers.Serializer):
    email = serializers.EmailField()