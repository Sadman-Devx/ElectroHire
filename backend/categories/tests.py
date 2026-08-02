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


class CategoryAdminTests(APITestCase):
    """Django Admin — Category Management Add/Edit/Delete (Dev 2, Day 5)."""

    def setUp(self):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        self.staff = User.objects.create_superuser(
            email="admin@electrohire.com", password="adminpass123", name="Admin"
        )
        self.client.force_login(self.staff)
        self.category = Category.objects.create(name="Electrician", icon="bulb")

    def test_add_category_via_admin(self):
        from django.urls import reverse
        response = self.client.post(
            reverse("admin:categories_category_add"),
            {"name": "Painter", "icon": "roller"},
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Category.objects.filter(name="Painter").exists())

    def test_edit_category_via_admin(self):
        from django.urls import reverse
        response = self.client.post(
            reverse("admin:categories_category_change", args=[self.category.id]),
            {"name": "Electrician", "icon": "zap"},
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        self.category.refresh_from_db()
        self.assertEqual(self.category.icon, "zap")

    def test_delete_category_via_admin(self):
        from django.urls import reverse
        response = self.client.post(
            reverse("admin:categories_category_delete", args=[self.category.id]),
            {"post": "yes"},
            follow=True,
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Category.objects.filter(id=self.category.id).exists())