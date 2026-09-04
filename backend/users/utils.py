"""
OTP delivery helper.

OTP *generation* now lives on the OTP model itself (OTP.create_for_email,
OTP.generate_code) — kept there because Dev 2's seed_test_otp management
command already calls OTP.create_for_email() directly, and a model
classmethod is the natural single source of truth both call sites (this
view and that command) can share. This module handles only sending the
email, which is specific to the register flow.
"""

from django.conf import settings
from django.core.mail import send_mail


def send_otp_email(email, otp_code):
    """
    Sends the OTP email. EMAIL_BACKEND is the console backend in dev
    (settings.py), so this prints the full email straight to the
    terminal running `manage.py runserver` — nothing external needed.
    """
    expiry_minutes = getattr(settings, "OTP_EXPIRY_MINUTES", 5)
    subject = "Your ElectroHire verification code"
    message = (
        f"Your ElectroHire OTP code is: {otp_code}\n"
        f"This code expires in {expiry_minutes} minutes.\n\n"
        f"If you didn't request this, you can safely ignore this email."
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@electrohire.com"),
        recipient_list=[email],
        fail_silently=False,
    )


def send_password_reset_email(email, otp_code):
    """
    Sends the password-reset OTP email (ForgotPasswordView). Same
    console-backend delivery as send_otp_email above — kept as a
    separate function (not a shared one with a `purpose` argument) so
    the subject/wording for "someone is trying to reset your password"
    reads distinctly from "verify your new signup" and can be edited
    independently later without a conditional in one function.
    """
    expiry_minutes = getattr(settings, "OTP_EXPIRY_MINUTES", 5)
    subject = "Your ElectroHire password reset code"
    message = (
        f"Your ElectroHire password reset code is: {otp_code}\n"
        f"This code expires in {expiry_minutes} minutes.\n\n"
        f"If you didn't request a password reset, you can safely ignore "
        f"this email — your password will not be changed."
    )
    send_mail(
        subject=subject,
        message=message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", "noreply@electrohire.com"),
        recipient_list=[email],
        fail_silently=False,
    )