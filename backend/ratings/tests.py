from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from contacts.models import ContactLog
from providers.models import Provider

from .models import Rating

User = get_user_model()


class RatingCreateViewTests(APITestCase):
    """POST /api/ratings/ -- Dev 2, Day 7."""

    def setUp(self):
        self.user = User.objects.create_user(
            email="user@example.com",
            name="Mahmudul Hasan",
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
        self.url = reverse("ratings:create")
        self.payload = {
            "provider_id": self.provider.id,
            "rating_value": 4,
            "review_text": "Very professional!",
            "tags": ["on_time", "professional"],
        }

    def _auth(self):
        self.client.force_authenticate(user=self.user)

    def test_unauthenticated_request_rejected(self):
        response = self.client.post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_rejects_rating_without_prior_contact(self):
        self._auth()
        response = self.client.post(self.url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["status"], "error")
        self.assertEqual(
            response.data["message"],
            "You must contact this provider before rating",
        )
        self.assertFalse(Rating.objects.exists())

    def test_creates_rating_after_contact(self):
        ContactLog.objects.create(user=self.user, provider=self.provider)
        self._auth()

        response = self.client.post(self.url, self.payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["message"], "Rating submitted")

        rating = Rating.objects.get(user=self.user, provider=self.provider)
        self.assertEqual(rating.rating_value, 4)
        self.assertEqual(rating.review_text, "Very professional!")
        self.assertEqual(rating.tags, ["on_time", "professional"])

    def test_resubmit_updates_existing_rating_instead_of_duplicating(self):
        ContactLog.objects.create(user=self.user, provider=self.provider)
        self._auth()
        self.client.post(self.url, self.payload, format="json")

        updated_payload = {**self.payload, "rating_value": 5, "review_text": "Even better!"}
        response = self.client.post(self.url, updated_payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Rating.objects.filter(user=self.user, provider=self.provider).count(), 1)
        rating = Rating.objects.get(user=self.user, provider=self.provider)
        self.assertEqual(rating.rating_value, 5)
        self.assertEqual(rating.review_text, "Even better!")

    def test_unknown_tags_are_silently_dropped(self):
        ContactLog.objects.create(user=self.user, provider=self.provider)
        self._auth()
        payload = {**self.payload, "tags": ["on_time", "not_a_real_tag"]}

        self.client.post(self.url, payload, format="json")

        rating = Rating.objects.get(user=self.user, provider=self.provider)
        self.assertEqual(rating.tags, ["on_time"])

    def test_invalid_provider_id_rejected(self):
        self._auth()
        payload = {**self.payload, "provider_id": 9999}

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_rating_value_out_of_range_rejected(self):
        ContactLog.objects.create(user=self.user, provider=self.provider)
        self._auth()
        payload = {**self.payload, "rating_value": 6}

        response = self.client.post(self.url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ProviderRatingListViewTests(APITestCase):
    """GET /api/providers/{id}/ratings/ -- Dev 2, Day 7."""

    def setUp(self):
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
        self.url = reverse("providers:ratings-list", args=[self.provider.id])

    def _rate(self, email, name, value, contact=True):
        phone = f"017{abs(hash(email)) % 10_000_000:07d}"
        user = User.objects.create_user(
            email=email,
            name=name,
            phone=phone,
            password="strongpassword123",
            role="user",
        )
        if contact:
            ContactLog.objects.create(user=user, provider=self.provider)
        Rating.objects.create(
            user=user,
            provider=self.provider,
            rating_value=value,
            review_text="Great!",
            tags=["professional"],
        )
        return user

    def test_no_auth_required(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_empty_when_no_ratings(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["avg_rating"], 0.0)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["data"], [])

    def test_returns_avg_rating_count_and_items(self):
        self._rate("a@example.com", "User A", 5)
        self._rate("b@example.com", "User B", 3)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["avg_rating"], 4.0)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(len(response.data["data"]), 2)
        item = response.data["data"][0]
        self.assertIn("user_name", item)
        self.assertIn("rating_value", item)
        self.assertIn("tags", item)
        self.assertIn("created_at", item)

    def test_unknown_provider_returns_404(self):
        url = reverse("providers:ratings-list", args=[9999])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ProviderAggregateFieldsTests(APITestCase):
    """
    Confirms Day 7's Rating model feeds real avg_rating/review_count into
    the Day 4 Provider list/detail endpoints (replacing the old 0/0.0
    placeholders).
    """

    def setUp(self):
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
        rater = User.objects.create_user(
            email="rater@example.com",
            name="Rater",
            phone="01788888888",
            password="strongpassword123",
            role="user",
        )
        Rating.objects.create(
            user=rater, provider=self.provider, rating_value=5, tags=[]
        )

    def test_provider_detail_shows_real_aggregate(self):
        url = reverse("providers:detail", args=[self.provider.id])
        response = self.client.get(url)

        self.assertEqual(response.data["data"]["avg_rating"], 5.0)
        self.assertEqual(response.data["data"]["review_count"], 1)

    def test_provider_list_shows_real_aggregate(self):
        url = reverse("providers:list")
        response = self.client.get(url)

        item = response.data["data"][0]
        self.assertEqual(item["avg_rating"], 5.0)
        self.assertEqual(item["review_count"], 1)