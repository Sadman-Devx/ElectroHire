from django.contrib import admin

from .models import OTP, User

admin.site.register(User)
admin.site.register(OTP)