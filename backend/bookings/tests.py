"""
Automated tests for Day 11 (Provider Booking System).

Run with:  python manage.py test bookings
"""

from datetime import timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from categories.models import Category
from providers.models import Provider
from users.models import User

from .models import Booking

TOMORROW = (timezone.localdate() + timedelta(days=1)).isoformat()


def _make_user(email, **extra):
    defaults = dict(
        password="strongpassword123",
        name="Test User",
        phone=None,
        role="user",
        is_active=True,
        verified=True,
    )
    defaults.update(extra)
    return User.objects.create_user(email=email, **defaults)


class BookingTestBase(APITestCase):
    def setUp(self):
        self.customer = _make_user(
            "customer@email.com", phone="01711111111", role="user"
        )
        self.provider_user = _make_user(
            "provider@email.com", phone="01722222222", role="provider"
        )
        self.category = Category.objects.create(name="Electrician", icon="bulb")
        self.provider = Provider.objects.create(
            user=self.provider_user,
            area="Dhanmondi",
            experience=5,
            status="active",
        )

        self.customer_token = self._token_for(self.customer)
        self.provider_token = self._token_for(self.provider_user)

    def _token_for(self, user):
        login = self.client.post(
            reverse("users:login"),
            {"email": user.email, "password": "strongpassword123"},
            format="json",
        )
        return login.json()["data"]["access_token"]

    def _auth(self, token):
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


# ════════════════════════════════════════════════════════════════
# POST /api/bookings/
# ════════════════════════════════════════════════════════════════
class BookingCreateAPITests(BookingTestBase):
    def setUp(self):
        super().setUp()
        self.url = reverse("bookings:create")
        self.payload = {
            "provider_id": self.provider.id,
            "category_id": self.category.id,
            "scheduled_date": TOMORROW,
            "scheduled_time": "14:30",
            "address": "House 12, Road 5, Dhanmondi",
            "description": "AC not cooling, need a checkup",
        }

    def test_create_requires_authentication(self):
        response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_success_returns_contract_shape(self):
        response = self.client.post(
            self.url, self.payload, format="json", **self._auth(self.customer_token)
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["data"]["status"], "pending")
        self.assertEqual(body["data"]["provider_name"], self.provider_user.name)

        booking = Booking.objects.get(user=self.customer, provider=self.provider)
        self.assertEqual(booking.address, "House 12, Road 5, Dhanmondi")
        self.assertEqual(booking.status, Booking.STATUS_PENDING)

    def test_create_without_category_is_allowed(self):
        payload = dict(self.payload)
        payload.pop("category_id")

        response = self.client.post(
            self.url, payload, format="json", **self._auth(self.customer_token)
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_unknown_provider_rejected(self):
        payload = dict(self.payload, provider_id=999999)
        response = self.client.post(
            self.url, payload, format="json", **self._auth(self.customer_token)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.json()["message"], "Provider not found.")

    def test_create_pending_provider_rejected(self):
        self.provider.status = "pending"
        self.provider.save(update_fields=["status"])

        response = self.client.post(
            self.url, self.payload, format="json", **self._auth(self.customer_token)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("not currently accepting bookings", response.json()["message"])

    def test_create_past_date_rejected(self):
        payload = dict(self.payload, scheduled_date="2020-01-01")
        response = self.client.post(
            self.url, payload, format="json", **self._auth(self.customer_token)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_missing_address_rejected(self):
        payload = dict(self.payload)
        payload.pop("address")
        response = self.client.post(
            self.url, payload, format="json", **self._auth(self.customer_token)
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


# ════════════════════════════════════════════════════════════════
# GET /api/bookings/mine/
# ════════════════════════════════════════════════════════════════
class BookingListAPITests(BookingTestBase):
    def setUp(self):
        super().setUp()
        self.url = reverse("bookings:list-mine")
        self.booking = Booking.objects.create(
            user=self.customer,
            provider=self.provider,
            category=self.category,
            scheduled_date=TOMORROW,
            scheduled_time="14:30",
            address="House 12, Road 5, Dhanmondi",
        )

    def test_list_requires_authentication(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_only_own_bookings(self):
        other_customer = _make_user("other@email.com", phone="01733333333")
        Booking.objects.create(
            user=other_customer,
            provider=self.provider,
            scheduled_date=TOMORROW,
            scheduled_time="10:00",
            address="Somewhere else",
        )

        response = self.client.get(self.url, **self._auth(self.customer_token))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["data"][0]["id"], self.booking.id)
        self.assertEqual(body["data"][0]["provider_name"], self.provider_user.name)


# ════════════════════════════════════════════════════════════════
# GET /api/bookings/provider/
# ════════════════════════════════════════════════════════════════
class ProviderBookingListAPITests(BookingTestBase):
    def setUp(self):
        super().setUp()
        self.url = reverse("bookings:list-provider")
        self.booking = Booking.objects.create(
            user=self.customer,
            provider=self.provider,
            scheduled_date=TOMORROW,
            scheduled_time="14:30",
            address="House 12, Road 5, Dhanmondi",
        )

    def test_provider_sees_incoming_bookings(self):
        response = self.client.get(self.url, **self._auth(self.provider_token))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["count"], 1)
        self.assertEqual(body["data"][0]["customer_name"], self.customer.name)
        self.assertEqual(body["data"][0]["customer_phone"], self.customer.phone)

    def test_non_provider_gets_404(self):
        response = self.client.get(self.url, **self._auth(self.customer_token))
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


# ════════════════════════════════════════════════════════════════
# PATCH /api/bookings/{id}/status/
# ════════════════════════════════════════════════════════════════
class BookingStatusUpdateAPITests(BookingTestBase):
    def setUp(self):
        super().setUp()
        self.booking = Booking.objects.create(
            user=self.customer,
            provider=self.provider,
            scheduled_date=TOMORROW,
            scheduled_time="14:30",
            address="House 12, Road 5, Dhanmondi",
        )
        self.url = reverse("bookings:status-update", args=[self.booking.id])

    def test_provider_can_confirm_pending_booking(self):
        response = self.client.patch(
            self.url,
            {"status": "confirmed"},
            format="json",
            **self._auth(self.provider_token),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.STATUS_CONFIRMED)

    def test_provider_can_reject_pending_booking(self):
        response = self.client.patch(
            self.url,
            {"status": "rejected"},
            format="json",
            **self._auth(self.provider_token),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.STATUS_REJECTED)

    def test_customer_can_cancel_pending_booking(self):
        response = self.client.patch(
            self.url,
            {"status": "cancelled"},
            format="json",
            **self._auth(self.customer_token),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.STATUS_CANCELLED)

    def test_customer_cannot_confirm_own_booking(self):
        response = self.client.patch(
            self.url,
            {"status": "confirmed"},
            format="json",
            **self._auth(self.customer_token),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.STATUS_PENDING)

    def test_provider_cannot_complete_still_pending_booking(self):
        response = self.client.patch(
            self.url,
            {"status": "completed"},
            format="json",
            **self._auth(self.provider_token),
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_provider_can_complete_confirmed_booking(self):
        self.booking.status = Booking.STATUS_CONFIRMED
        self.booking.save(update_fields=["status"])

        response = self.client.patch(
            self.url,
            {"status": "completed"},
            format="json",
            **self._auth(self.provider_token),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, Booking.STATUS_COMPLETED)

    def test_stranger_cannot_update_status(self):
        stranger = _make_user("stranger@email.com", phone="01799999999")
        stranger_token = self._token_for(stranger)

        response = self.client.patch(
            self.url,
            {"status": "confirmed"},
            format="json",
            **self._auth(stranger_token),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unknown_booking_returns_404(self):
        url = reverse("bookings:status-update", args=[999999])
        response = self.client.patch(
            url,
            {"status": "confirmed"},
            format="json",
            **self._auth(self.provider_token),
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)