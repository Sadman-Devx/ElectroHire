from django.urls import path

from .views import LoginView, RegisterView, VerifyOTPView

app_name = "users"

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("verify-otp/", VerifyOTPView.as_view(), name="verify-otp"),
    path("login/", LoginView.as_view(), name="login"),  # Dev 1, Day 3
]