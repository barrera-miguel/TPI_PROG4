import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// Stores
import { useAuthStore } from './stores/authStore'

// Services
import { authService } from './services/auth.service'

// Components
import { Navbar } from './components/Navbar'
import { CartDrawer } from './components/CartDrawer'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastProvider } from './components/Toast'

// Pages públicas
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { ProductosPage } from './pages/ProductosPage'
import { ProductoDetallePage } from './pages/ProductoDetallePage'

// Pages cliente
import { DireccionesPage } from './pages/direcciones/DireccionesPage'
import { CheckoutPage } from './pages/checkout/CheckoutPage'
import { PedidosPage } from './pages/pedidos/PedidosPage'
import { PedidoDetallePage } from './pages/pedidos/PedidoDetallePage'
import { PagoResultPage } from './pages/pedidos/PagoResultPage'

// Pages admin
import { AdminLayout } from './pages/admin/AdminLayout'
import { DashboardPage } from './pages/admin/DashboardPage'
import { AdminPedidosPage } from './pages/admin/AdminPedidosPage'
import { ProductosAdminPage } from './pages/admin/ProductosAdminPage'
import { CategoriasPage } from './pages/admin/CategoriasPage'
import { IngredientesPage } from './pages/admin/IngredientesPage'
import { UnidadesMedidaPage } from './pages/admin/UnidadesMedidaPage'
import { UsuariosPage } from './pages/admin/UsuariosPage'

function HomeRedirect() {
  const { isAdmin, isPedidos, isStock, isLoading } = useAuthStore()
  if (isLoading) return null
  if (isAdmin()) return <Navigate to="/admin" replace />
  if (isPedidos()) return <Navigate to="/admin/pedidos" replace />
  if (isStock()) return <Navigate to="/admin/productos" replace />
  return <ProductosPage />
}

function AppInner() {
  const { setUsuario, setLoading } = useAuthStore()
  const [cartOpen, setCartOpen] = useState(false)
  const qc = useQueryClient()

  // Hidratar usuario al cargar la app
  useEffect(() => {
    authService.me()
      .then(u => setUsuario(u))
      .catch(() => setUsuario(null))
      .finally(() => setLoading(false))
  }, [])

  // Re-intentar queries fallidas tras refresh de token
  useEffect(() => {
    const handler = () => { qc.invalidateQueries() }
    window.addEventListener('token-refreshed', handler)
    return () => window.removeEventListener('token-refreshed', handler)
  }, [qc])

  return (
    <>
      <Navbar onOpenCart={() => setCartOpen(true)} />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />

      <Routes>
        {/* Públicas */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/productos/:id" element={<ProductoDetallePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Cliente autenticado */}
        <Route path="/profile/addresses" element={<ProtectedRoute><DireccionesPage /></ProtectedRoute>} />
        <Route path="/checkout" element={<ProtectedRoute roles={['CLIENT', 'ADMIN']}><CheckoutPage /></ProtectedRoute>} />
        <Route path="/orders" element={<ProtectedRoute><PedidosPage /></ProtectedRoute>} />
        <Route path="/orders/:id" element={<ProtectedRoute><PedidoDetallePage /></ProtectedRoute>} />
        <Route path="/orders/:id/:estado" element={<ProtectedRoute><PagoResultPage /></ProtectedRoute>} />

        {/* Admin */}
        <Route path="/admin" element={<ProtectedRoute roles={['ADMIN', 'PEDIDOS', 'STOCK']}><AdminLayout /></ProtectedRoute>}>
          <Route index element={<ProtectedRoute roles={['ADMIN']}><DashboardPage /></ProtectedRoute>} />
          <Route path="pedidos" element={<ProtectedRoute roles={['ADMIN', 'PEDIDOS']}><AdminPedidosPage /></ProtectedRoute>} />
          <Route path="productos" element={<ProtectedRoute roles={['ADMIN', 'STOCK']}><ProductosAdminPage /></ProtectedRoute>} />
          <Route path="categorias" element={<ProtectedRoute roles={['ADMIN']}><CategoriasPage /></ProtectedRoute>} />
          <Route path="ingredientes" element={<ProtectedRoute roles={['ADMIN', 'STOCK']}><IngredientesPage /></ProtectedRoute>} />
          <Route path="unidades-medida" element={<ProtectedRoute roles={['ADMIN']}><UnidadesMedidaPage /></ProtectedRoute>} />
          <Route path="usuarios" element={<ProtectedRoute roles={['ADMIN']}><UsuariosPage /></ProtectedRoute>} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  )
}
