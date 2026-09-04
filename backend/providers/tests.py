from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.test import APITestCase

from categories.models import Category
from contacts.models import ContactLog, Message
from ratings.models import Rating

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

    def test_includes_user_id_for_chat_entry_point(self):
        """
        Regression test — added alongside the "Send Message" fix in
        StickyContactCard.jsx (frontend). user_id isn't in the API
        Contract PDF for this endpoint; see ProviderDetailSerializer's
        docstring for why it's needed anyway.
        """
        url = reverse("providers:detail", kwargs={"pk": self.provider.id})
        response = self.client.get(url)
        self.assertEqual(response.data["data"]["user_id"], self.user.id)


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


class ProviderDashboardViewTests(APITestCase):
    """GET /api/providers/dashboard/ — Dev 2, Day 9."""

    def setUp(self):
        self.provider_user = User.objects.create_user(
            email="karim@example.com", password="strongpass123", name="Karim Uddin",
            role=User.ROLE_PROVIDER, verified=True, is_active=True,
        )
        self.provider = Provider.objects.create(user=self.provider_user, status="active")

        self.customer_1 = User.objects.create_user(
            email="c1@example.com", password="pass12345", name="Customer One",
            role=User.ROLE_USER, is_active=True,
        )
        self.customer_2 = User.objects.create_user(
            email="c2@example.com", password="pass12345", name="Customer Two",
            role=User.ROLE_USER, is_active=True,
        )

        ContactLog.objects.create(user=self.customer_1, provider=self.provider)
        ContactLog.objects.create(user=self.customer_2, provider=self.provider)

        Rating.objects.create(
            user=self.customer_1, provider=self.provider, rating_value=5,
            review_text="Great work",
        )
        Rating.objects.create(
            user=self.customer_2, provider=self.provider, rating_value=3,
        )

        self.url = reverse("providers:dashboard")
        access_token = RefreshToken.for_user(self.provider_user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def test_requires_auth(self):
        self.client.credentials()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_non_provider_gets_403(self):
        access_token = RefreshToken.for_user(self.customer_1).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_stats_are_correct(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

        data = response.data["data"]
        self.assertEqual(data["contacts_count"], 2)
        self.assertEqual(data["ratings_count"], 2)
        self.assertEqual(data["avg_rating"], 4.0)  # (5 + 3) / 2

    def test_recent_messages_empty_when_no_unread_incoming_messages(self):
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["recent_messages"], [])

    def test_recent_messages_deduplicates_same_customer_to_latest_only(self):
        # Customer One sends 3 unread messages in a row -- these should
        # collapse into a single row (the newest one), not 3 separate rows.
        for i in range(3):
            Message.objects.create(
                sender=self.customer_1, receiver=self.provider_user,
                content=f"message {i}",
            )

        response = self.client.get(self.url)
        messages = response.data["data"]["recent_messages"]

        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["content"], "message 2")
        self.assertEqual(messages[0]["sender_name"], "Customer One")

    def test_recent_messages_excludes_providers_own_outgoing_messages(self):
        # The provider messaging a customer should never appear in their
        # own "Recent messages" preview -- that list is for messages
        # waiting on the provider's attention, not a sent-mail log.
        Message.objects.create(
            sender=self.provider_user, receiver=self.customer_1,
            content="Kal sokal 9 tar dike ashbo",
        )

        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["recent_messages"], [])

    def test_recent_messages_excludes_already_read_messages(self):
        Message.objects.create(
            sender=self.customer_1, receiver=self.provider_user,
            content="already seen this one", is_read=True,
        )

        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["recent_messages"], [])

    def test_recent_messages_disappears_once_the_thread_is_read(self):
        Message.objects.create(
            sender=self.customer_1, receiver=self.provider_user,
            content="please help",
        )

        # Unread -> shows up.
        response = self.client.get(self.url)
        self.assertEqual(len(response.data["data"]["recent_messages"]), 1)

        # Provider opens the thread -- the same GET the Chat page already
        # calls, which marks incoming messages read (see
        # MessageListCreateViewTests.test_get_marks_incoming_messages_as_read
        # for that behavior's own dedicated coverage).
        thread_url = reverse(
            "contacts:message-thread", args=[self.provider.id]
        )
        response = self.client.get(f"{thread_url}?with={self.customer_1.id}")
        self.assertEqual(response.status_code, 200)

        # Now reading the dashboard again, that conversation is gone.
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"]["recent_messages"], [])

    def test_recent_messages_capped_at_three_distinct_customers_newest_first(self):
        customer_3 = User.objects.create_user(
            email="c3@example.com", password="pass12345", name="Customer Three",
            role=User.ROLE_USER, is_active=True,
        )
        customer_4 = User.objects.create_user(
            email="c4@example.com", password="pass12345", name="Customer Four",
            role=User.ROLE_USER, is_active=True,
        )

        for customer in (self.customer_1, self.customer_2, customer_3, customer_4):
            Message.objects.create(
                sender=customer, receiver=self.provider_user,
                content=f"hi from {customer.name}",
            )

        response = self.client.get(self.url)
        messages = response.data["data"]["recent_messages"]

        self.assertEqual(len(messages), 3)
        self.assertEqual(messages[0]["sender_name"], "Customer Four")

    def test_recent_reviews_shape_matches_provider_ratings_list(self):
        response = self.client.get(self.url)
        reviews = response.data["data"]["recent_reviews"]

        self.assertEqual(len(reviews), 2)
        self.assertEqual(
            set(reviews[0].keys()),
            {"user_name", "rating_value", "review_text", "tags", "created_at"},
        )



class ProviderMeViewTests(APITestCase):
    """GET /api/providers/me/ — Dev 3, Day 9."""

    def setUp(self):
        self.provider_user = User.objects.create_user(
            email="karim@example.com", password="strongpass123", name="Karim Uddin",
            role=User.ROLE_PROVIDER, verified=True, is_active=True,
        )
        self.electrician = Category.objects.create(name="Electrician", icon="bulb")
        self.ac_repair = Category.objects.create(name="AC Repair", icon="ac")

        self.url = reverse("providers:me")
        access_token = RefreshToken.for_user(self.provider_user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

    def test_requires_auth(self):
        self.client.credentials()
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 401)

    def test_no_provider_profile_gets_403(self):
        # Same 403 (not 404) ProviderDashboardView already uses for the
        # identical "authenticated, but no Provider row yet" condition —
        # kept consistent on purpose, see the view's docstring.
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_returns_own_profile_with_category_ids_status_and_verified(self):
        provider = Provider.objects.create(
            user=self.provider_user,
            area="Dhanmondi",
            experience=8,
            description="Pro electrician",
            status="active",
        )
        ProviderCategory.objects.create(provider=provider, category=self.electrician)
        ProviderCategory.objects.create(provider=provider, category=self.ac_repair)

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

        data = response.data["data"]
        self.assertEqual(data["area"], "Dhanmondi")
        self.assertEqual(data["experience"], 8)
        self.assertEqual(data["description"], "Pro electrician")
        self.assertEqual(data["status"], "active")
        self.assertTrue(data["verified"])
        self.assertEqual(
            {category["id"] for category in data["categories"]},
            {self.electrician.id, self.ac_repair.id},
        )
        self.assertEqual(
            {category["name"] for category in data["categories"]},
            {"Electrician", "AC Repair"},
        )

    def test_never_returns_another_users_provider(self):
        other_user = User.objects.create_user(
            email="other@example.com", password="strongpass123", name="Other Provider",
            role=User.ROLE_PROVIDER, verified=True, is_active=True,
        )
        Provider.objects.create(user=other_user, area="Gulshan", experience=2, status="active")

        # self.provider_user (the authenticated caller) still has no
        # Provider row of their own.
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    def test_unverified_user_gets_verified_false(self):
        unverified_user = User.objects.create_user(
            email="unverified@example.com", password="strongpass123", name="New Provider",
            role=User.ROLE_PROVIDER, verified=False, is_active=True,
        )
        Provider.objects.create(user=unverified_user, area="Mirpur", experience=1, status="pending")

        access_token = RefreshToken.for_user(unverified_user).access_token
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")

        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["data"]["verified"])
        self.assertEqual(response.data["data"]["status"], "pending")