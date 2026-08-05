from django.urls import path

from .views import ContactCreateView

app_name = "contacts"

urlpatterns = [
    path("", ContactCreateView.as_view(), name="contact-create"),
    # --- Coordination note for Dev 1 (Day 7) ---
    # Dev 1 will add the following under this same /api/contacts/ prefix:
    #   GET  /api/contacts/messages/<int:provider_id>/   -> message list
    #   POST /api/contacts/messages/<int:provider_id>/   -> message send
    #   GET  /api/contacts/conversations/                -> conversation list
    # Please avoid reusing the path name "contact-create" or the bare ""
    # path when wiring those in, to prevent a URL name/route collision.
]