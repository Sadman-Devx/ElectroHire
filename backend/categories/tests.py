from django.urls import reverse
from rest_framework.test import APITestCase

from .models import Category


class CategoryListTests(APITestCase):
    """GET /api/categories/ — Dev 1, Day 4."""

    def setUp(self):
        self.url = reverse("categories:list")
        Category.objects.create(name="Electrician", icon="bulb")
        Category.objects.create(name="Plumber", icon="pipe")
        Category.objects.create(name="Tutor", icon="book")

    def test_returns_200_no_auth(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)

    def test_response_shape_matches_contract(self):
        response = self.client.get(self.url)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(len(response.data["data"]), 3)
        first = response.data["data"][0]
        self.assertEqual(set(first.keys()), {"id", "name", "icon"})

    def test_empty_when_no_categories(self):
        Category.objects.all().delete()
        response = self.client.get(self.url)
        self.assertEqual(response.data["data"], [])