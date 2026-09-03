"""
URL configuration for electrohire project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path

urlpatterns = [
    path("api/contacts/", include("contacts.urls")),
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/categories/', include('categories.urls')),  # Dev 1, Day 4
    path('api/providers/', include('providers.urls')),
    path('api/ratings/', include('ratings.urls')),  # Dev 2, Day 7
    path('api/reports/', include('reports.urls')),  # Dev 2, Day 8
    path('api/bookings/', include('bookings.urls')),  # Dev 2, Day 11
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)


# ── Day 10, Dev 1 ────────────────────────────────────────────────────
# A URL that matches no urlpattern at all never reaches a DRF view, so
# core/exceptions.py's custom_exception_handler (which only fires for
# exceptions raised *inside* a view) can't normalize it — Django's own
# 404 machinery handles it first. With DEBUG=True (dev, always) Django
# shows its HTML debug page regardless of handler404 below; that's
# expected in dev and harmless (it dies with DEBUG=False anyway). This
# only takes effect in production (DEBUG=False), where the frontend
# would otherwise get an HTML 404 page instead of JSON for a typo'd or
# stale API path — same {"status", "message"} contract as every other
# endpoint, instead of Django's default plain-text/HTML 404.
def api_not_found(request, exception=None):
    return JsonResponse(
        {"status": "error", "message": "The requested endpoint was not found."},
        status=404,
    )


handler404 = api_not_found