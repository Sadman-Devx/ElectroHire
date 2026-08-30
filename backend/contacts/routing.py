"""
WebSocket URL routing for real-time chat -- the ws:// equivalent of
contacts/urls.py, wired in by electrohire/asgi.py.

`provider_id` mirrors the REST route
(messages/<int:provider_id>/) exactly: it's always a Provider PK,
never a raw User id, same as every other provider_id in this app.
"""

from django.urls import re_path

from .consumers import ChatConsumer

websocket_urlpatterns = [
    re_path(r"^ws/chat/(?P<provider_id>\d+)/$", ChatConsumer.as_asgi()),
]