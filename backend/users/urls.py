from django.urls import path

from .views import (
    LoginView,
    MeView,
    RefreshTokenView,
    RegisterView,
    ResendOTPView,
    VerifyOTPView,
)

app_name = "users"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("resend-otp/", ResendOTPView.as_view(), name="resend-otp"),
    path("login/", LoginView.as_view(), name="login"),
    # --- Day 9, Dev 1 ---
    path("refresh/", RefreshTokenView.as_view(), name="refresh"),
    path("me/", MeView.as_view(), name="me"),
]