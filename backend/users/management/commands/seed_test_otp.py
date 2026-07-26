from django.core.management.base import BaseCommand

from users.models import OTP, User


class Command(BaseCommand):
    """
    Usage: python manage.py seed_test_otp
    Creates/reuses a test user + fresh OTP so Dev 2 can Postman-test
    verify-otp/ without waiting on Dev 1's register/generate-otp API.
    """

    help = "Seed a test user + OTP for manually testing /api/auth/verify-otp/"

    def add_arguments(self, parser):
        parser.add_argument("--email", default="test@example.com")

    def handle(self, *args, **options):
        email = options["email"]
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "name": "Test User",
                "phone": "01700000000",
                "role": "user",
                "is_active": False,
                "verified": False,
            },
        )
        if created:
            user.set_password("TestPass123")
            user.save()

        otp = OTP.create_for_email(email)

        self.stdout.write(self.style.SUCCESS(f"User: {email} (created={created})"))
        self.stdout.write(self.style.SUCCESS(f"OTP: {otp.otp_code} (expires_at={otp.expires_at})"))
        self.stdout.write("POST body -> " + '{"email": "%s", "otp": "%s"}' % (email, otp.otp_code))