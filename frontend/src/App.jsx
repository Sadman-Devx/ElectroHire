import { Routes, Route } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import HomePage from '@/pages/HomePage'
import SignupPage from '@/pages/SignupPage'
import LoginPage from '@/pages/LoginPage'
import VerifyOtpPage from '@/pages/VerifyOtpPage'
import ProvidersPage from '@/pages/ProvidersPage'
import ProviderProfileSetupPage from '@/pages/ProviderProfileSetupPage'
import AccountPlaceholder from '@/pages/AccountPlaceholder'

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-muted)]">
      Page not found.
    </div>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/providers" element={<ProvidersPage />} />
      <Route
        path="/provider/profile-setup"
        element={
          <ProtectedRoute>
            <ProviderProfileSetupPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPlaceholder />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App