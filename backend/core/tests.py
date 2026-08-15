from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from categories.models import Category
from contacts.models import ContactLog
from providers.models import Provider, ProviderCategory
from ratings.models import Rating

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