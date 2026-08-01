from rest_framework.generics import ListAPIView
from rest_framework.permissions import AllowAny

from core.response import success_response

from .models import Category
from .serializers import CategorySerializer


# ── Dev 1, Day 4 ─────────────────────────────────────────────────────
class CategoryListView(ListAPIView):
    """
    GET /api/categories/  — public, no auth required.

    Response (per API Contract):
        {
          "status": "success",
          "data": [ {"id": 1, "name": "Electrician", "icon": "bulb"}, ... ]
        }
    """

    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_queryset(), many=True)
        return success_response(data=serializer.data)