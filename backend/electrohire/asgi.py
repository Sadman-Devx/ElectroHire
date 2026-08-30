"""
ASGI config for electrohire project.

It exposes the ASGI callable as a module-level variable named ``application``.
Plain HTTP still goes through Django exactly as before (WSGI_APPLICATION is
untouched, and this http branch below is the same Django app); the only
thing added is a websocket branch for real-time chat
(contacts/consumers.py ChatConsumer), routed by provider_id exactly like
the existing REST endpoints in contacts/urls.py.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'electrohire.settings')

# get_asgi_application() must run BEFORE anything below imports code that
# touches Django models (Channels routing/consumers included) -- it's what
# populates Django's app registry. Importing contacts.routing any earlier
# raises "Apps aren't loaded yet".
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402

import contacts.routing  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        # OriginValidator rejects a handshake whose Origin header isn't
        # in this list -- the WebSocket equivalent of
        # CORS_ALLOWED_ORIGINS, and deliberately reuses that exact list
        # (settings.py) rather than ALLOWED_HOSTS: the frontend runs on
        # a different host:port than the API in dev (and often a
        # different domain entirely in production), so "is this origin
        # one we serve REST requests to" is the right question here,
        # not "is this our own hostname". Auth itself is handled inside
        # ChatConsumer.connect() via the JWT in the query string (this
        # API has no session cookies to protect), so no
        # AuthMiddlewareStack is needed on top of this.
        "websocket": OriginValidator(
            URLRouter(contacts.routing.websocket_urlpatterns),
            settings.CORS_ALLOWED_ORIGINS,
        ),
    }
)