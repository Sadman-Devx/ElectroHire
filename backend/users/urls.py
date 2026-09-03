from django.urls import path

from .views import (
    AccountDeleteView,
    ForgotPasswordView,
    LoginView,
    MeView,
    RefreshTokenView,
    RegisterView,
    ResendOTPView,
    ResetPasswordView,
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
    # --- Day 11, Dev 2 --- Forgot/Reset Password + Account Delete
    path("forgot-password/", ForgotPasswordView.as_view(), name="forgot-password"),
    path("reset-password/", ResetPasswordView.as_view(), name="reset-password"),
    path("account/", AccountDeleteView.as_view(), name="account-delete"),
]