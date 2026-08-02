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


class ProviderListTests(APITestCase):
    """GET /api/providers/ — Dev 1, Day 4."""

    def setUp(self):
        self.url = reverse("providers:list")

        self.electrician = Category.objects.create(name="Electrician", icon="bulb")
        self.plumber = Category.objects.create(name="Plumber", icon="pipe")

        karim = User.objects.create_user(
            email="karim3@example.com", password="strongpass123",
            name="Karim Uddin", phone="01911111111", role=User.ROLE_PROVIDER,
        )
        self.karim_provider = Provider.objects.create(
            user=karim, area="Dhanmondi", experience=8, status="active"
        )
        ProviderCategory.objects.create(provider=self.karim_provider, category=self.electrician)

        rahim = User.objects.create_user(
            email="rahim3@example.com", password="strongpass123",
            name="Rahim Mia", phone="01922222222", role=User.ROLE_PROVIDER,
        )
        self.rahim_provider = Provider.objects.create(
            user=rahim, area="Mirpur", experience=4, status="active"
        )
        ProviderCategory.objects.create(provider=self.rahim_provider, category=self.plumber)

        pending_user = User.objects.create_user(
            email="pending3@example.com", password="strongpass123",
            name="Pending Guy", phone="01933333333", role=User.ROLE_PROVIDER,
        )
        self.pending_provider = Provider.objects.create(
            user=pending_user, area="Dhanmondi", experience=1, status="pending"
        )
        ProviderCategory.objects.create(provider=self.pending_provider, category=self.electrician)

    def test_returns_200_no_auth(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

    def test_response_shape_matches_contract(self):
        response = self.client.get(self.url)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("count", response.data)
        item = response.data["data"][0]
        self.assertEqual(
            set(item.keys()),
            {"id", "name", "area", "experience", "photo", "categories", "avg_rating", "review_count", "status"},
        )

    def test_only_active_providers_listed(self):
        response = self.client.get(self.url)
        ids = {item["id"] for item in response.data["data"]}
        self.assertNotIn(self.pending_provider.id, ids)
        self.assertEqual(response.data["count"], 2)

    def test_filter_by_category(self):
        response = self.client.get(self.url, {"category": self.plumber.id})
        ids = {item["id"] for item in response.data["data"]}
        self.assertEqual(ids, {self.rahim_provider.id})

    def test_filter_by_area_case_insensitive(self):
        response = self.client.get(self.url, {"area": "dhanmondi"})
        ids = {item["id"] for item in response.data["data"]}
        self.assertEqual(ids, {self.karim_provider.id})

    def test_filter_by_area_no_match(self):
        response = self.client.get(self.url, {"area": "Gulshan"})
        self.assertEqual(response.data["data"], [])
        self.assertEqual(response.data["count"], 0)

    def test_combined_filters(self):
        response = self.client.get(
            self.url, {"category": self.electrician.id, "area": "Dhanmondi"}
        )
        ids = {item["id"] for item in response.data["data"]}
        self.assertEqual(ids, {self.karim_provider.id})


class ProviderAdminApproveRejectTests(APITestCase):
    """Django Admin — Provider Approve/Reject custom actions (Dev 2, Day 5)."""

    def setUp(self):
        self.staff = User.objects.create_superuser(
            email="admin@electrohire.com", password="adminpass123", name="Admin"
        )
        self.client.force_login(self.staff)

        self.pending_user_1 = User.objects.create_user(
            email="prov1@example.com", password="pass12345", name="Provider One",
            role=User.ROLE_PROVIDER, is_active=True,
        )
        self.pending_user_2 = User.objects.create_user(
            email="prov2@example.com", password="pass12345", name="Provider Two",
            role=User.ROLE_PROVIDER, is_active=True,
        )
        self.provider_1 = Provider.objects.create(user=self.pending_user_1, status="pending")
        self.provider_2 = Provider.objects.create(user=self.pending_user_2, status="pending")
        self.changelist_url = reverse("admin:providers_provider_changelist")

    def test_approve_action_sets_status_active(self):
        response = self.client.post(self.changelist_url, {
            "action": "approve_providers",
            "_selected_action": [str(self.provider_1.id)],
        }, follow=True)

        self.assertEqual(response.status_code, 200)
        self.provider_1.refresh_from_db()
        self.assertEqual(self.provider_1.status, "active")

    def test_reject_action_sets_status_rejected(self):
        response = self.client.post(self.changelist_url, {
            "action": "reject_providers",
            "_selected_action": [str(self.provider_2.id)],
        }, follow=True)

        self.assertEqual(response.status_code, 200)
        self.provider_2.refresh_from_db()
        self.assertEqual(self.provider_2.status, "rejected")

    def test_approve_action_is_bulk(self):
        response = self.client.post(self.changelist_url, {
            "action": "approve_providers",
            "_selected_action": [str(self.provider_1.id), str(self.provider_2.id)],
        }, follow=True)

        self.assertEqual(response.status_code, 200)
        self.provider_1.refresh_from_db()
        self.provider_2.refresh_from_db()
        self.assertEqual(self.provider_1.status, "active")
        self.assertEqual(self.provider_2.status, "active")

    def test_status_filter_present_on_changelist(self):
        response = self.client.get(self.changelist_url, {"status__exact": "pending"})
        self.assertEqual(response.status_code, 200)
        ids = {p.id for p in response.context["cl"].queryset}
        self.assertEqual(ids, {self.provider_1.id, self.provider_2.id})