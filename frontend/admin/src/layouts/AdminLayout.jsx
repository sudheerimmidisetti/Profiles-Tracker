import { Navigate, Outlet } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import AdminSidebar from '../components/AdminSidebar'

export default function AdminLayout() {
  const { loggedIn } = useAdminAuth()

  if (!loggedIn) return <Navigate to="/login" replace />

  return (
    <div className="app-layout">
      <AdminSidebar />
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  )
}
