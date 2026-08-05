from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from providers.models import Provider
from .models import ContactLog

User = get_user_model()


class ContactCreateViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            name="Test User",
            phone="01700000000",
            password="strongpassword123",
            role="user",
        )
        self.provider_user = User.objects.create_user(
            email="provider@example.com",
            name="Karim Uddin",
            phone="01711111111",
            password="strongpassword123",
            role="provider",
        )
        self.provider = Provider.objects.create(
            user=self.provider_user,
            area="Dhanmondi",
            experience=8,
            description="Professional electrician.",
            status="active",
        )
        self.url = reverse("contacts:contact-create")

    def _auth(self):
        self.client.force_authenticate(user=self.user)

    def test_unauthenticated_request_rejected(self):
        response = self.client.post(self.url, {"provider_id": self.provider.id})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_creates_contact_log(self):
        self._auth()
        response = self.client.post(self.url, {"provider_id": self.provider.id})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"]["provider_name"], "Karim Uddin")
        self.assertEqual(ContactLog.objects.count(), 1)

    def test_repeated_contact_does_not_duplicate(self):
        self._auth()
        first = self.client.post(self.url, {"provider_id": self.provider.id})
        second = self.client.post(self.url, {"provider_id": self.provider.id})
        self.assertEqual(ContactLog.objects.count(), 1)
        self.assertEqual(
            first.data["data"]["contact_id"],
            second.data["data"]["contact_id"],
        )

    def test_missing_provider_id(self):
        self._auth()
        response = self.client.post(self.url, {})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")

    def test_invalid_provider_id(self):
        self._auth()
        response = self.client.post(self.url, {"provider_id": 999999})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")