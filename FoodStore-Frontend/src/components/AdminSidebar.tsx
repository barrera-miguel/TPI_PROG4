import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'

const items = [
  { to: '/admin', label: '📊 Dashboard', exact: true, roles: ['ADMIN'] },
  { to: '/admin/pedidos', label: '🧾 Pedidos', roles: ['ADMIN', 'PEDIDOS'] },
  { to: '/admin/productos', label: '🍽️ Productos', roles: ['ADMIN', 'STOCK'] },
  { to: '/admin/categorias', label: '🗂️ Categorías', roles: ['ADMIN'] },
  { to: '/admin/ingredientes', label: '🥬 Ingredientes', roles: ['ADMIN', 'STOCK'] },
  { to: '/admin/unidades-medida', label: '📏 Unidades', roles: ['ADMIN'] },
  { to: '/admin/usuarios', label: '👤 Usuarios', roles: ['ADMIN'] },
]

export function AdminSidebar() {
  const { hasRole } = useAuthStore()
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar-section">Administración</div>
      {items.filter(i => i.roles.some(r => hasRole(r))).map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) => `admin-sidebar-item${isActive ? ' active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </aside>
  )
}
