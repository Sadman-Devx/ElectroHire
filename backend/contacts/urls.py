from django.urls import path

from .views import ContactCreateView, ConversationListView, MessageListCreateView

app_name = "contacts"

urlpatterns = [
    path("", ContactCreateView.as_view(), name="contact-create"),
    # --- Day 7, Dev 1 ---
    # "conversations/" is registered before "messages/<provider_id>/" on
    # purpose: Django resolves urlpatterns top-to-bottom, and a literal
    # path always needs to be checked ahead of a variable one it could be
    # confused with (not the case here since the segments differ, but
    # keeping literal-before-variable is the safer default).
    path(
        "conversations/",
        ConversationListView.as_view(),
        name="conversation-list",
    ),
    path(
        "messages/<int:provider_id>/",
        MessageListCreateView.as_view(),
        name="message-thread",
    ),
]