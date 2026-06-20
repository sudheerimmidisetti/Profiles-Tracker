import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider }           from './context/AuthContext'
import AppLayout                  from './layouts/AppLayout'
import LoginPage                  from './pages/LoginPage'
import DashboardPage              from './pages/DashboardPage'
import LeaderboardPage            from './pages/LeaderboardPage'
import AnalyticsPage              from './pages/AnalyticsPage'
import ProfilePage                from './pages/ProfilePage'
import VerifyHandlersPage         from './pages/VerifyHandlersPage'
import PlatformProfilePage        from './pages/PlatformProfilePage'
import ContestPage                from './pages/ContestPage'
import ContestCalendarPage        from './pages/ContestCalendarPage'
import PublicLeaderboardPage      from './pages/PublicLeaderboardPage'
import PublicContestPage          from './pages/PublicContestPage'
import PublicProfilePage          from './pages/PublicProfilePage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          {/* Auth */}
          <Route path="/login" element={<LoginPage />} />

          {/* Public — no auth needed, shareable links */}
          <Route path="/public/leaderboard"        element={<PublicLeaderboardPage />} />
          <Route path="/public/contests"           element={<PublicContestPage />} />
          <Route path="/public/profile/:rollNumber" element={<PublicProfilePage />} />

          {/* Protected — all wrapped in AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/"                   element={<DashboardPage />} />
            <Route path="/leaderboard"         element={<LeaderboardPage />} />
            <Route path="/analytics"           element={<AnalyticsPage />} />
            <Route path="/profile"             element={<ProfilePage />} />
            <Route path="/settings"            element={<ProfilePage />} />
            <Route path="/verify-handlers"     element={<VerifyHandlersPage />} />
            <Route path="/platform/:platform"  element={<PlatformProfilePage />} />
            <Route path="/contests"            element={<ContestPage />} />
            <Route path="/contest-calendar"    element={<ContestCalendarPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
