from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APITestCase

from categories.models import Category
from contacts.models import ContactLog
from providers.models import Provider, ProviderCategory
from ratings.models import Rating

from .response import first_error_message

User = get_user_model()


class AdminDashboardStatsTests(TestCase):
    """
    Dev 2, Day 5 — Admin Dashboard Basic Stats (Total User/Provider/Pending).
    Dev 2, Day 9 — Admin Dashboard Stats Complete (+ Contacts, Ratings,
    Contact Rate primary metric).
    """

    def setUp(self):
        self.staff = User.objects.create_superuser(
            email="admin@electrohire.com", password="adminpass123", name="Admin"
        )
        self.client.force_login(self.staff)

        self.electrician = Category.objects.create(name="Electrician", icon="bulb")

        # 2 plain "user" role accounts.
        self.user_1 = User.objects.create_user(
            email="u1@example.com", password="pass12345", name="User One",
            role=User.ROLE_USER, is_active=True,
        )
        self.user_2 = User.objects.create_user(
            email="u2@example.com", password="pass12345", name="User Two",
            role=User.ROLE_USER, is_active=True,
        )

        # 1 pending + 1 active provider.
        pending_user = User.objects.create_user(
            email="p1@example.com", password="pass12345", name="Provider One",
            role=User.ROLE_PROVIDER, is_active=True,
        )
        active_user = User.objects.create_user(
            email="p2@example.com", password="pass12345", name="Provider Two",
            role=User.ROLE_PROVIDER, is_active=True,
        )
        self.pending_provider = Provider.objects.create(user=pending_user, status="pending")
        self.active_provider = Provider.objects.create(user=active_user, status="active")
        ProviderCategory.objects.create(provider=self.pending_provider, category=self.electrician)

        # Day 9: only user_1 has contacted/rated a provider — user_2 stays
        # an unengaged registrant, so contact_rate should land at 50.0
        # (1 of 2 "user"-role accounts), not 100 or based on raw row counts.
        ContactLog.objects.create(user=self.user_1, provider=self.active_provider)
        Rating.objects.create(
            user=self.user_1, provider=self.active_provider, rating_value=5
        )

    def test_admin_index_returns_200(self):
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 200)

    def test_dashboard_stats_counts_are_correct(self):
        response = self.client.get(reverse("admin:index"))
        stats = response.context["dashboard_stats"]

        self.assertEqual(stats["total_users"], 2)
        self.assertEqual(stats["total_providers"], 2)
        self.assertEqual(stats["pending_providers"], 1)
        self.assertEqual(stats["active_providers"], 1)

    def test_dashboard_stats_contacts_ratings_and_contact_rate(self):
        response = self.client.get(reverse("admin:index"))
        stats = response.context["dashboard_stats"]

        self.assertEqual(stats["total_contacts"], 1)
        self.assertEqual(stats["total_ratings"], 1)
        self.assertEqual(stats["contact_rate"], 50.0)

    def test_contact_rate_counts_each_user_once_not_per_contact_row(self):
        # user_1 contacts a second provider too — total_contacts goes up,
        # but contact_rate (a per-USER metric) must stay unchanged since
        # no *additional* user became engaged.
        second_provider_user = User.objects.create_user(
            email="p3@example.com", password="pass12345", name="Provider Three",
            role=User.ROLE_PROVIDER, is_active=True,
        )
        second_provider = Provider.objects.create(user=second_provider_user, status="active")
        ContactLog.objects.create(user=self.user_1, provider=second_provider)

        response = self.client.get(reverse("admin:index"))
        stats = response.context["dashboard_stats"]

        self.assertEqual(stats["total_contacts"], 2)
        self.assertEqual(stats["contact_rate"], 50.0)

    def test_contact_rate_is_zero_when_no_regular_users_exist(self):
        User.objects.filter(role=User.ROLE_USER).delete()

        response = self.client.get(reverse("admin:index"))
        stats = response.context["dashboard_stats"]

        self.assertEqual(stats["total_users"], 0)
        self.assertEqual(stats["contact_rate"], 0.0)

    def test_dashboard_stats_rendered_in_page(self):
        response = self.client.get(reverse("admin:index"))
        self.assertContains(response, "Total Users")
        self.assertContains(response, "Pending Providers")
        self.assertContains(response, "Contact Rate")

    def test_anonymous_redirected_to_login(self):
        self.client.logout()
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 302)


# ════════════════════════════════════════════════════════════════
# Dev 1, Day 10 — custom_exception_handler
#
# Bug: every hand-written view returns {"status": "error", "message":
# "..."} via core.response.error_response, but exceptions DRF itself
# raises before a view's code runs (missing/invalid auth, unsupported
# method, ...) previously fell through to DRF's default handler
# instead, replying with a bare {"detail": "..."} (or, for an invalid
# JWT, {"detail": ..., "code": ..., "messages": [...]}) — a differently
# shaped error body than literally everywhere else in the app. Found
# during the Day 10 E2E audit while exercising the JWT refresh flow.
# ════════════════════════════════════════════════════════════════
class CustomExceptionHandlerTests(TestCase):
    def setUp(self):
        self.electrician = Category.objects.create(name="Electrician", icon="bulb")

    def test_missing_auth_header_matches_contract_shape(self):
        response = self.client.get(reverse("users:me"))

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertEqual(body["status"], "error")
        self.assertIn("message", body)
        self.assertNotIn("detail", body)
        self.assertEqual(
            body["message"], "Authentication credentials were not provided."
        )

    def test_invalid_jwt_matches_contract_shape(self):
        response = self.client.get(
            reverse("users:me"), HTTP_AUTHORIZATION="Bearer garbage.not.a.token"
        )

        self.assertEqual(response.status_code, 401)
        body = response.json()
        self.assertEqual(body["status"], "error")
        self.assertIn("message", body)
        self.assertNotIn("detail", body)
        self.assertNotIn("messages", body)

    def test_unsupported_http_method_matches_contract_shape(self):
        response = self.client.delete(reverse("categories:list"))

        self.assertEqual(response.status_code, 405)
        body = response.json()
        self.assertEqual(body["status"], "error")
        self.assertIn("message", body)
        self.assertNotIn("detail", body)


# ════════════════════════════════════════════════════════════════
# Dev 2, Day 10 — core.response.first_error_message nested-error bug
#
# Bug: found during the Day 10 E2E provider-journey pass while sending
# a malformed `categories` list to POST /api/providers/profile/. A
# ListField(child=...) whose *child* fails validation nests its error
# one level deeper than a plain field does -- {"categories": {0: [...
# ]}} instead of {"categories": [...]} -- and the old
# first_error_message only ever checked one list level deep, so it
# fell into its `else: str(value)` branch for that dict-shaped case
# and returned Python's raw repr of the whole nested structure
# ("{0: [ErrorDetail(string='A valid integer is required.', ...)]}")
# as the top-level "message" instead of a clean sentence -- the exact
# thing this helper exists to prevent. Fixed by making it recurse
# through arbitrary nesting instead of stopping after one level.
# ════════════════════════════════════════════════════════════════
class FirstErrorMessageNestedErrorTests(TestCase):
    def test_plain_field_error_unaffected(self):
        errors = {"email": ["Email already exists"]}
        self.assertEqual(first_error_message(errors), "Email already exists")

    def test_non_field_errors_unaffected(self):
        errors = {"non_field_errors": ["Something went wrong."]}
        self.assertEqual(first_error_message(errors), "Something went wrong.")

    def test_nested_listfield_child_error_returns_clean_message(self):
        # Shape DRF actually produces for
        # ListField(child=IntegerField())'s child validation failure.
        errors = {"categories": {0: ["A valid integer is required."]}}
        self.assertEqual(
            first_error_message(errors), "A valid integer is required."
        )

    def test_nested_error_never_returns_raw_repr(self):
        errors = {"categories": {0: ["A valid integer is required."]}}
        message = first_error_message(errors)
        self.assertNotIn("ErrorDetail", message)
        self.assertNotIn("{0:", message)

    def test_deterministic_field_order_preserved_with_nesting(self):
        # sorted(keys()) ordering must still hold once a field's own
        # value can itself be a dict (not just a list) needing a sort key.
        errors = {
            "zzz_field": ["Should not be picked first"],
            "area": {0: ["First alphabetically"]},
        }
        self.assertEqual(first_error_message(errors), "First alphabetically")

    def test_empty_errors_dict_falls_back(self):
        self.assertEqual(first_error_message({}), "Invalid data")


class ProviderProfileSetupNestedValidationErrorTests(APITestCase):
    """
    Same bug as above, exercised through the real endpoint end-to-end
    (not just the helper in isolation) — this is the exact request that
    surfaced it during the Day 10 E2E pass.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            email="karim.nested@example.com",
            password="strongpass123",
            name="Karim Uddin",
            phone="01712340099",
            role=User.ROLE_PROVIDER,
            verified=True,
            is_active=True,
        )
        access_token = RefreshToken.for_user(self.user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def test_non_integer_category_item_returns_clean_message(self):
        response = self.client.post(
            reverse("providers:profile-setup"),
            {"categories": ["not-a-number"], "area": "Dhanmondi", "experience": 5},
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status"], "error")
        self.assertNotIn("ErrorDetail", response.data["message"])
        self.assertNotIn("{0:", response.data["message"])
        self.assertEqual(
            response.data["message"], "A valid integer is required."
        )