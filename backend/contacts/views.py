from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from core.response import success_response, error_response
from providers.models import Provider
from .models import ContactLog
from .serializers import ContactCreateSerializer, ContactLogResponseSerializer


class ContactCreateView(APIView):
    """
    POST /api/contacts/
    Auth required. Creates (or returns the existing) ContactLog for the
    authenticated user + given provider. Idempotent by design — calling
    this repeatedly for the same provider (e.g. on 'reveal number') never
    creates a duplicate row.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ContactCreateSerializer(data=request.data)
        if not serializer.is_valid():
            first_error = next(iter(serializer.errors.values()))[0]
            return error_response(
                message=str(first_error),
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        provider_id = serializer.validated_data["provider_id"]
        provider = Provider.objects.select_related("user").get(id=provider_id)

        contact_log, _created = ContactLog.objects.get_or_create(
            user=request.user,
            provider=provider,
        )

        response_data = ContactLogResponseSerializer(contact_log).data
        return success_response(
            data=response_data,
            message="Contact logged",
            status_code=status.HTTP_201_CREATED,
        )