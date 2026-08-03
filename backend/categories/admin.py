from django.contrib import admin

from .models import Category


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    """
    Day 5: Category Management (Add/Edit/Delete).

    Django's default ModelAdmin already gives full Add/Edit/Delete CRUD
    for free — this registration just makes that CRUD pleasant to use:
    inline icon editing from the list view, search, and a live count of
    how many providers currently list each category (handy before
    deleting one, since deleting a Category cascades through the
    ProviderCategory junction table).
    """

    list_display = ["id", "name", "icon", "provider_count"]
    list_editable = ["icon"]
    search_fields = ["name"]
    ordering = ["name"]
    list_per_page = 50

    @admin.display(description="Providers using this")
    def provider_count(self, obj):
        return obj.providers.count()