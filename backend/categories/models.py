from django.db import models


class Category(models.Model):
    """Category Model — id, name, icon (matches API_Contract.pdf)."""

    name = models.CharField(max_length=100, unique=True)
    icon = models.CharField(max_length=50, blank=True, help_text="Icon key, e.g. 'bulb', 'pipe'")

    class Meta:
        ordering = ["name"]
        verbose_name_plural = "Categories"

    def __str__(self):
        return self.name