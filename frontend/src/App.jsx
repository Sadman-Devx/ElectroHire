import { Routes, Route } from 'react-router-dom'

import { ProtectedRoute } from '@/components/ProtectedRoute'
import HomePage from '@/pages/HomePage'
import SignupPage from '@/pages/SignupPage'
import LoginPage from '@/pages/LoginPage'
import VerifyOtpPage from '@/pages/VerifyOtpPage'
import ProvidersPage from '@/pages/ProvidersPage'
import ProviderDetailPage from '@/pages/ProviderDetailPage'
import ProviderProfileSetupPage from '@/pages/ProviderProfileSetupPage'
import ProviderProfileEditPage from '@/pages/ProviderProfileEditPage'
import ProviderPendingPage from '@/pages/ProviderPendingPage'
import ProviderDashboardPage from '@/pages/ProviderDashboardPage'
import AccountPage from '@/pages/AccountPage'
import UserDashboardPage from '@/pages/UserDashboardPage'
import ChatsPage from '@/pages/ChatsPage'
import RateProviderPage from '@/pages/RateProviderPage'
import ReportProviderPage from '@/pages/ReportProviderPage'
import TermsPage from '@/pages/TermsPage'

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
      <Route path="/providers/:id" element={<ProviderDetailPage />} />

      {/* Day 8, Dev 3 */}
      <Route
        path="/providers/:id/rate"
        element={
          <ProtectedRoute>
            <RateProviderPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/providers/:id/report"
        element={
          <ProtectedRoute>
            <ReportProviderPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/provider/profile-setup"
        element={
          <ProtectedRoute>
            <ProviderProfileSetupPage />
          </ProtectedRoute>
        }
      />

      {/* Day 9, Dev 3 */}
      <Route
        path="/provider/profile-edit"
        element={
          <ProtectedRoute>
            <ProviderProfileEditPage />
          </ProtectedRoute>
        }
      />

      {/* Day 6, Dev 3 */}
      <Route
        path="/provider/pending"
        element={
          <ProtectedRoute>
            <ProviderPendingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/provider/dashboard"
        element={
          <ProtectedRoute>
            <ProviderDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Day 7, Dev 3 */}
      <Route
        path="/chats"
        element={
          <ProtectedRoute>
            <ChatsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />

      {/* Day 9, Dev 3 */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserDashboardPage />
          </ProtectedRoute>
        }
      />

      {/* Day 9, Dev 1 — public: no reason to gate legal text behind login */}
      <Route path="/terms" element={<TermsPage />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App