"""
Automated tests for Day 2 (Signup + OTP + Verify).

Run with:  python manage.py test users
"""

from django.core import mail
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from .models import OTP, User

VALID_PAYLOAD = {
    "name": "Mahmudul Hasan",
    "email": "mahmudul@email.com",
    "phone": "01712345678",
    "password": "strongpassword123",
    "role": "user",
}


# ════════════════════════════════════════════════════════════════
# Dev 1 — POST /api/auth/register/
# ════════════════════════════════════════════════════════════════
class RegisterAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("users:register")

    def test_register_success_returns_contract_shape(self):
        response = self.client.post(self.url, VALID_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            response.json(),
            {"status": "success", "message": "OTP sent to your email"},
        )

    def test_register_creates_unverified_inactive_user_with_hashed_password(self):
        self.client.post(self.url, VALID_PAYLOAD, format="json")

        user = User.objects.get(email="mahmudul@email.com")
        self.assertEqual(user.name, "Mahmudul Hasan")
        self.assertEqual(user.phone, "01712345678")
        self.assertEqual(user.role, "user")
        self.assertFalse(user.verified)
        self.assertFalse(user.is_active)  # stays inactive until verify-otp succeeds
        self.assertNotEqual(user.password, "strongpassword123")
        self.assertTrue(user.check_password("strongpassword123"))

    def test_register_creates_otp_with_correct_expiry_window(self):
        before = timezone.now()
        self.client.post(self.url, VALID_PAYLOAD, format="json")
        after = timezone.now()

        otp = OTP.objects.get(email="mahmudul@email.com")
        self.assertEqual(len(otp.otp_code), 6)
        self.assertTrue(otp.otp_code.isdigit())
        self.assertFalse(otp.is_used)
        self.assertGreater(otp.expires_at, before + timezone.timedelta(minutes=4))
        self.assertLess(otp.expires_at, after + timezone.timedelta(minutes=6))

    def test_register_sends_otp_email_to_console_backend(self):
        self.client.post(self.url, VALID_PAYLOAD, format="json")

        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.to, ["mahmudul@email.com"])
        otp = OTP.objects.get(email="mahmudul@email.com")
        self.assertIn(otp.otp_code, sent.body)

    def test_register_provider_role_allowed(self):
        payload = {**VALID_PAYLOAD, "email": "karim@email.com",
                   "phone": "01812345678", "role": "provider"}
        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.get(email="karim@email.com").role, "provider")

    def test_duplicate_verified_email_is_rejected(self):
        User.objects.create_user(
            email="mahmudul@email.com", password="whatever123", name="Existing",
            phone="01911111111", role="user", verified=True,
        )

        response = self.client.post(self.url, VALID_PAYLOAD, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["status"], "error")
        self.assertEqual(response.json()["message"], "Email already exists")

    def test_duplicate_unverified_email_lets_user_retry_signup(self):
        self.client.post(self.url, VALID_PAYLOAD, format="json")
        first_otp = OTP.objects.get(email="mahmudul@email.com")

        retry_payload = {**VALID_PAYLOAD, "password": "differentpassword456"}
        response = self.client.post(self.url, retry_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(email="mahmudul@email.com").count(), 1)
        user = User.objects.get(email="mahmudul@email.com")
        self.assertTrue(user.check_password("differentpassword456"))

        first_otp.refresh_from_db()
        self.assertTrue(first_otp.is_used)

    def test_duplicate_phone_different_email_is_rejected(self):
        User.objects.create_user(
            email="someoneelse@email.com", password="whatever123", name="Someone",
            phone="01712345678", role="user", verified=True,
        )

        response = self.client.post(self.url, VALID_PAYLOAD, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_required_fields_returns_400(self):
        response = self.client.post(self.url, {"email": "x@example.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_role_rejected(self):
        payload = {**VALID_PAYLOAD, "role": "admin"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_invalid_phone_format_rejected(self):
        payload = {**VALID_PAYLOAD, "phone": "12345"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_weak_password_rejected(self):
        payload = {**VALID_PAYLOAD, "email": "weak@email.com",
                   "phone": "01711111111", "password": "1234567"}
        response = self.client.post(self.url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_no_auth_required_for_register(self):
        response = self.client.post(self.url, VALID_PAYLOAD, format="json")
        self.assertNotEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


class OTPModelTests(APITestCase):
    def test_is_expired_and_is_valid(self):
        past = OTP.objects.create(
            email="a@a.com", otp_code="123456",
            expires_at=timezone.now() - timezone.timedelta(minutes=1),
        )
        future = OTP.objects.create(
            email="b@b.com", otp_code="654321",
            expires_at=timezone.now() + timezone.timedelta(minutes=5),
        )
        self.assertTrue(past.is_expired())
        self.assertFalse(past.is_valid())
        self.assertFalse(future.is_expired())
        self.assertTrue(future.is_valid())

    def test_create_for_email_invalidates_previous_otp(self):
        first = OTP.create_for_email("c@c.com")
        second = OTP.create_for_email("c@c.com")

        first.refresh_from_db()
        self.assertTrue(first.is_used)
        self.assertFalse(second.is_used)
        self.assertNotEqual(first.otp_code, second.otp_code)


# ════════════════════════════════════════════════════════════════
# Dev 2 — POST /api/auth/verify-otp/
# ════════════════════════════════════════════════════════════════
class VerifyOTPAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("users:verify-otp")
        self.user = User.objects.create_user(
            email="karim@email.com", password="strongpassword123", name="Karim Uddin",
            phone="01712345600", role="provider", is_active=False, verified=False,
        )
        self.otp = OTP.create_for_email("karim@email.com")

    def test_verify_success_returns_tokens_and_activates_user(self):
        response = self.client.post(
            self.url, {"email": "karim@email.com", "otp": self.otp.otp_code}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["message"], "Account verified")
        self.assertIn("access_token", body["data"])
        self.assertIn("refresh_token", body["data"])
        self.assertEqual(body["data"]["role"], "provider")

        self.user.refresh_from_db()
        self.assertTrue(self.user.verified)
        self.assertTrue(self.user.is_active)

        self.otp.refresh_from_db()
        self.assertTrue(self.otp.is_used)

    def test_verify_wrong_code_rejected(self):
        response = self.client.post(
            self.url, {"email": "karim@email.com", "otp": "000000"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["message"], "Invalid or expired OTP")

        self.user.refresh_from_db()
        self.assertFalse(self.user.verified)

    def test_verify_expired_code_rejected(self):
        self.otp.expires_at = timezone.now() - timezone.timedelta(minutes=1)
        self.otp.save()

        response = self.client.post(
            self.url, {"email": "karim@email.com", "otp": self.otp.otp_code}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_already_used_code_rejected(self):
        self.otp.is_used = True
        self.otp.save()

        response = self.client.post(
            self.url, {"email": "karim@email.com", "otp": self.otp.otp_code}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_unknown_email_returns_400(self):
        # No OTP exists for this email either, so it's rejected before
        # the "no account" branch is even reached — matches current
        # behavior (OTP lookup happens first).
        response = self.client.post(
            self.url, {"email": "nobody@email.com", "otp": "123456"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_verify_missing_fields_returns_400(self):
        response = self.client.post(self.url, {"email": "karim@email.com"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ════════════════════════════════════════════════════════════════
# Dev 1 — POST /api/auth/login/  (Day 3)
# ════════════════════════════════════════════════════════════════
class LoginAPITests(APITestCase):
    def setUp(self):
        self.url = reverse("users:login")
        self.user = User.objects.create_user(
            email="mahmudul@email.com",
            password="strongpassword123",
            name="Mahmudul Hasan",
            phone="01712345678",
            role="user",
            is_active=True,
            verified=True,
        )

    def test_login_success_returns_contract_shape(self):
        response = self.client.post(
            self.url,
            {"email": "mahmudul@email.com", "password": "strongpassword123"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertIn("access_token", body["data"])
        self.assertIn("refresh_token", body["data"])
        self.assertEqual(body["data"]["role"], "user")
        self.assertEqual(body["data"]["name"], "Mahmudul Hasan")

    def test_login_is_case_insensitive_on_email(self):
        response = self.client.post(
            self.url,
            {"email": "MAHMUDUL@Email.com", "password": "strongpassword123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_login_wrong_password_rejected(self):
        response = self.client.post(
            self.url,
            {"email": "mahmudul@email.com", "password": "wrongpassword"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["message"], "Invalid email or password")

    def test_login_unknown_email_rejected_with_same_generic_message(self):
        # Same message as wrong-password above — doesn't leak whether
        # the account exists.
        response = self.client.post(
            self.url,
            {"email": "nobody@email.com", "password": "whatever123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["message"], "Invalid email or password")

    def test_login_unverified_account_rejected_with_specific_message(self):
        User.objects.create_user(
            email="karim@email.com", password="strongpassword123", name="Karim Uddin",
            phone="01712345600", role="provider", is_active=False, verified=False,
        )
        response = self.client.post(
            self.url,
            {"email": "karim@email.com", "password": "strongpassword123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(
            response.json()["message"], "Please verify your email before logging in"
        )

    def test_login_missing_password_returns_400(self):
        response = self.client.post(
            self.url, {"email": "mahmudul@email.com"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_missing_email_returns_400(self):
        response = self.client.post(
            self.url, {"password": "strongpassword123"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_malformed_email_returns_400(self):
        response = self.client.post(
            self.url,
            {"email": "not-an-email", "password": "strongpassword123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_provider_role_returned_correctly(self):
        User.objects.create_user(
            email="karim2@email.com", password="strongpassword123", name="Karim Uddin",
            phone="01712345601", role="provider", is_active=True, verified=True,
        )
        response = self.client.post(
            self.url,
            {"email": "karim2@email.com", "password": "strongpassword123"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["data"]["role"], "provider")

    def test_login_tokens_are_valid_jwt_for_the_correct_user(self):
        from rest_framework_simplejwt.tokens import AccessToken

        response = self.client.post(
            self.url,
            {"email": "mahmudul@email.com", "password": "strongpassword123"},
            format="json",
        )
        access = response.json()["data"]["access_token"]
        token = AccessToken(access)
        self.assertEqual(str(token["user_id"]), str(self.user.id))

    def test_no_auth_required_for_login(self):
        response = self.client.post(
            self.url,
            {"email": "mahmudul@email.com", "password": "strongpassword123"},
            format="json",
        )
        self.assertNotEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)


# ════════════════════════════════════════════════════════════════
# Combined — Signup → Verify → Login all the way through, proving
# Dev 1's Day 2 register + Day 3 login and Dev 2's Day 2 verify-otp
# all interoperate on the same account.
# ════════════════════════════════════════════════════════════════
class FullAuthJourneyTests(APITestCase):
    def test_register_then_verify_then_login(self):
        register_url = reverse("users:register")
        verify_url = reverse("users:verify-otp")
        login_url = reverse("users:login")

        self.client.post(register_url, VALID_PAYLOAD, format="json")
        otp = OTP.objects.get(email="mahmudul@email.com", is_used=False)
        self.client.post(
            verify_url, {"email": "mahmudul@email.com", "otp": otp.otp_code}, format="json"
        )

        login_response = self.client.post(
            login_url,
            {"email": "mahmudul@email.com", "password": "strongpassword123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.json()["data"]["name"], "Mahmudul Hasan")

    def test_login_before_verifying_otp_is_rejected(self):
        register_url = reverse("users:register")
        login_url = reverse("users:login")

        self.client.post(register_url, VALID_PAYLOAD, format="json")

        login_response = self.client.post(
            login_url,
            {"email": "mahmudul@email.com", "password": "strongpassword123"},
            format="json",
        )
        self.assertEqual(login_response.status_code, status.HTTP_403_FORBIDDEN)
    def test_register_then_verify_full_flow(self):
        register_url = reverse("users:register")
        verify_url = reverse("users:verify-otp")

        # Step 1: register
        register_response = self.client.post(register_url, VALID_PAYLOAD, format="json")
        self.assertEqual(register_response.status_code, status.HTTP_201_CREATED)

        user = User.objects.get(email="mahmudul@email.com")
        self.assertFalse(user.is_active)

        # Step 2: pull the OTP that was emailed (as the frontend would
        # get it from the user's inbox)
        otp = OTP.objects.get(email="mahmudul@email.com", is_used=False)

        # Step 3: verify
        verify_response = self.client.post(
            verify_url, {"email": "mahmudul@email.com", "otp": otp.otp_code}, format="json"
        )
        self.assertEqual(verify_response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", verify_response.json()["data"])

        user.refresh_from_db()
        self.assertTrue(user.verified)
        self.assertTrue(user.is_active)

# ════════════════════════════════════════════════════════════════
# Dev 1, Day 9 — GET /api/auth/me/
# ════════════════════════════════════════════════════════════════
class MeViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="mahmudul@email.com",
            name="Mahmudul Hasan",
            phone="01712345678",
            password="strongpassword123",
            role="user",
            verified=True,
        )
        self.url = reverse("users:me")

    def test_unauthenticated_request_rejected(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_returns_the_caller_own_profile(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()["data"]
        self.assertEqual(data["name"], "Mahmudul Hasan")
        self.assertEqual(data["email"], "mahmudul@email.com")
        self.assertEqual(data["role"], "user")
        self.assertTrue(data["verified"])
        self.assertIn("member_since", data)


# ════════════════════════════════════════════════════════════════
# Dev 1, Day 9 — POST /api/auth/refresh/
# ════════════════════════════════════════════════════════════════
class RefreshTokenViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="mahmudul@email.com",
            name="Mahmudul Hasan",
            phone="01712345678",
            password="strongpassword123",
            role="user",
            verified=True,
        )
        self.url = reverse("users:refresh")

    def _login(self):
        login_response = self.client.post(
            reverse("users:login"),
            {"email": "mahmudul@email.com", "password": "strongpassword123"},
            format="json",
        )
        return login_response.json()["data"]["refresh_token"]

    def test_missing_refresh_token_returns_400(self):
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["status"], "error")

    def test_invalid_refresh_token_returns_401(self):
        response = self.client.post(
            self.url, {"refresh_token": "not-a-real-token"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_valid_refresh_token_returns_new_access_token(self):
        refresh_token = self._login()

        response = self.client.post(
            self.url, {"refresh_token": refresh_token}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access_token", response.json()["data"])
        self.assertTrue(len(response.json()["data"]["access_token"]) > 20)

    def test_new_access_token_actually_authenticates(self):
        refresh_token = self._login()
        refresh_response = self.client.post(
            self.url, {"refresh_token": refresh_token}, format="json"
        )
        new_access = refresh_response.json()["data"]["access_token"]

        response = self.client.get(
            reverse("users:me"), HTTP_AUTHORIZATION=f"Bearer {new_access}"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["data"]["email"], "mahmudul@email.com")