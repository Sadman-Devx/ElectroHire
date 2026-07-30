from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APITestCase

from categories.models import Category

from .models import Provider, ProviderCategory

User = get_user_model()


class ProviderProfileSetupTests(APITestCase):
    """POST /api/providers/profile/ — Dev 2, Day 4."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="karim@example.com",
            password="strongpass123",
            name="Karim Uddin",
            phone="01712345678",
            role=User.ROLE_PROVIDER,
            verified=True,
            is_active=True,
        )
        self.electrician = Category.objects.create(name="Electrician", icon="bulb")
        self.ac_repair = Category.objects.create(name="AC Repair", icon="ac")
        self.url = reverse("providers:profile-setup")

        access_token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def test_requires_auth(self):
        self.client.credentials()  # drop the Authorization header
        response = self.client.post(self.url, {"area": "Dhanmondi"})
        self.assertEqual(response.status_code, 401)

    def test_creates_provider_with_pending_status(self):
        payload = {
            "categories": [self.electrician.id, self.ac_repair.id],
            "area": "Dhanmondi",
            "experience": 8,
            "description": "Professional electrician",
        }
        response = self.client.post(self.url, payload)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["message"], "Profile submitted for review")

        provider = Provider.objects.get(user=self.user)
        self.assertEqual(provider.status, "pending")
        self.assertEqual(provider.area, "Dhanmondi")
        self.assertEqual(provider.experience, 8)
        self.assertEqual(
            set(provider.categories.values_list("id", flat=True)),
            {self.electrician.id, self.ac_repair.id},
        )

    def test_resubmit_resets_status_to_pending_and_replaces_categories(self):
        provider = Provider.objects.create(
            user=self.user, area="Old Area", experience=1, status="active"
        )
        ProviderCategory.objects.create(provider=provider, category=self.ac_repair)

        payload = {
            "categories": [self.electrician.id],
            "area": "Gulshan",
            "experience": 5,
        }
        response = self.client.post(self.url, payload)
        self.assertEqual(response.status_code, 201)

        provider.refresh_from_db()
        self.assertEqual(provider.status, "pending")
        self.assertEqual(provider.area, "Gulshan")
        self.assertEqual(
            list(provider.categories.values_list("id", flat=True)),
            [self.electrician.id],
        )

    def test_invalid_category_id_rejected(self):
        payload = {"categories": [9999], "area": "Dhanmondi", "experience": 2}
        response = self.client.post(self.url, payload)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")

    def test_missing_required_field_rejected(self):
        response = self.client.post(
            self.url, {"categories": [self.electrician.id]}
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")


class ProviderDetailTests(APITestCase):
    """GET /api/providers/{id}/ — Dev 2, Day 4."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="karim2@example.com",
            password="strongpass123",
            name="Karim Uddin",
            phone="01812345678",
            role=User.ROLE_PROVIDER,
        )
        self.category = Category.objects.create(name="Electrician", icon="bulb")
        self.provider = Provider.objects.create(
            user=self.user,
            area="Dhanmondi",
            experience=8,
            description="Professional electrician",
            status="active",
        )
        ProviderCategory.objects.create(
            provider=self.provider, category=self.category
        )

    def test_public_access_no_auth_required(self):
        url = reverse("providers:detail", kwargs={"pk": self.provider.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")

    def test_response_shape_matches_contract(self):
        url = reverse("providers:detail", kwargs={"pk": self.provider.id})
        response = self.client.get(url)
        data = response.data["data"]

        self.assertEqual(data["name"], "Karim Uddin")
        self.assertEqual(data["area"], "Dhanmondi")
        self.assertEqual(data["experience"], 8)
        self.assertEqual(data["description"], "Professional electrician")
        self.assertEqual(data["categories"], ["Electrician"])
        self.assertIn("avg_rating", data)
        self.assertIn("review_count", data)
        self.assertIn("member_since", data)

    def test_not_found_returns_404(self):
        url = reverse("providers:detail", kwargs={"pk": 9999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["status"], "error")