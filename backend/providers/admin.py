from django.contrib import admin

from .models import Provider, ProviderCategory


class ProviderCategoryInline(admin.TabularInline):
    model = ProviderCategory
    extra = 1


@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ["id", "user", "area", "experience", "status", "created_at"]
    list_filter = ["status", "area"]
    search_fields = ["user__name", "user__email", "area"]
    inlines = [ProviderCategoryInline]


@admin.register(ProviderCategory)
class ProviderCategoryAdmin(admin.ModelAdmin):
    list_display = ["id", "provider", "category"]