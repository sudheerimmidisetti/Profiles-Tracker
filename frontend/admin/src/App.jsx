import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext'
import AdminLayout          from './layouts/AdminLayout'
import AdminLoginPage       from './pages/AdminLoginPage'
import OverviewPage         from './pages/OverviewPage'
import StudentsPage         from './pages/StudentsPage'
import StudentDetailPage    from './pages/StudentDetailPage'
import LeaderboardPage      from './pages/LeaderboardPage'
import AnalyticsPage        from './pages/AnalyticsPage'
import BlocklistPage        from './pages/BlocklistPage'
import AdminTeamPage        from './pages/AdminTeamPage'
import HandleRequestsPage   from './pages/HandleRequestsPage'
import SettingsPage         from './pages/SettingsPage'
import ContestPage          from './pages/ContestPage'

function ProtectedRoute({ children }) {
  const { loggedIn } = useAdminAuth()
  if (!loggedIn) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<AdminLoginPage />} />

          <Route element={
            <ProtectedRoute><AdminLayout /></ProtectedRoute>
          }>
            <Route path="/"                 element={<OverviewPage />} />
            <Route path="/students"         element={<StudentsPage />} />
            <Route path="/students/:email"  element={<StudentDetailPage />} />
            <Route path="/leaderboard"      element={<LeaderboardPage />} />
            <Route path="/analytics"        element={<AnalyticsPage />} />
            <Route path="/blocklist"        element={<BlocklistPage />} />
            <Route path="/team"             element={<AdminTeamPage />} />
            <Route path="/handle-requests" element={<HandleRequestsPage />} />
            <Route path="/contests"         element={<ContestPage />} />
            <Route path="/settings"         element={<SettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  )
}
