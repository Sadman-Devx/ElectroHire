from django.conf import settings
from django.db import models

from categories.models import Category


class Provider(models.Model):
    """Provider Model — user(FK), area, experience, description, photo, status."""

    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("active", "Active"),
        ("rejected", "Rejected"),
    )

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="provider_profile"
    )
    categories = models.ManyToManyField(
        Category, through="ProviderCategory", related_name="providers", blank=True
    )
    area = models.CharField(max_length=100, blank=True)
    experience = models.PositiveIntegerField(default=0, help_text="Years of experience")
    description = models.TextField(blank=True)
    photo = models.ImageField(upload_to="provider_photos/", blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.name} ({self.status})"


class ProviderCategory(models.Model):
    """Explicit Junction Table — Provider <-> Category (many-to-many)."""

    provider = models.ForeignKey(Provider, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("provider", "category")
        verbose_name_plural = "Provider Categories"

    def __str__(self):
        return f"{self.provider} -> {self.category}"   