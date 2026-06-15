import { Outlet } from 'react-router-dom'
import { AdminSidebar } from '../../components/AdminSidebar'

export function AdminLayout() {
  return (
    <div className="page-wrapper">
      <div className="admin-layout">
        <AdminSidebar />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
