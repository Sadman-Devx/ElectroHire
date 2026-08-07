from django.contrib import admin

from .models import Rating


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "provider", "rating_value", "created_at")
    list_filter = ("rating_value", "created_at")
    search_fields = ("user__name", "provider__user__name", "review_text")
    autocomplete_fields = ("user", "provider")