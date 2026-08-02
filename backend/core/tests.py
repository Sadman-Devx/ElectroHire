from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from categories.models import Category
from providers.models import Provider, ProviderCategory

User = get_user_model()


class AdminDashboardStatsTests(TestCase):
    """Dev 2, Day 5 — Admin Dashboard Basic Stats (Total User/Provider/Pending)."""

    def setUp(self):
        self.staff = User.objects.create_superuser(
            email="admin@electrohire.com", password="adminpass123", name="Admin"
        )
        self.client.force_login(self.staff)

        self.electrician = Category.objects.create(name="Electrician", icon="bulb")

        # 2 plain "user" role accounts.
        User.objects.create_user(
            email="u1@example.com", password="pass12345", name="User One",
            role=User.ROLE_USER, is_active=True,
        )
        User.objects.create_user(
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

    def test_dashboard_stats_rendered_in_page(self):
        response = self.client.get(reverse("admin:index"))
        self.assertContains(response, "Total Users")
        self.assertContains(response, "Pending Providers")

    def test_anonymous_redirected_to_login(self):
        self.client.logout()
        response = self.client.get(reverse("admin:index"))
        self.assertEqual(response.status_code, 302)