import { Routes, Route } from 'react-router-dom'

import HomePlaceholder from '@/pages/HomePlaceholder'
import SignupPage from '@/pages/SignupPage'
import LoginPage from '@/pages/LoginPage'
import VerifyOtpPlaceholder from '@/pages/VerifyOtpPlaceholder'

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
      <Route path="/" element={<HomePlaceholder />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPlaceholder />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App