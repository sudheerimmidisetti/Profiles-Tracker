import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'

import AppLayout from './layouts/AppLayout'
import LoginPage           from './pages/LoginPage'
import DashboardPage       from './pages/DashboardPage'
import LeaderboardPage     from './pages/LeaderboardPage'
import AnalyticsPage       from './pages/AnalyticsPage'
import ProfilePage         from './pages/ProfilePage'
import VerifyHandlersPage  from './pages/VerifyHandlersPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected — all wrapped in AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/"                element={<DashboardPage />} />
            <Route path="/leaderboard"     element={<LeaderboardPage />} />
            <Route path="/analytics"       element={<AnalyticsPage />} />
            <Route path="/profile"         element={<ProfilePage />} />
            <Route path="/settings"        element={<ProfilePage />} />
            <Route path="/verify-handlers" element={<VerifyHandlersPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
