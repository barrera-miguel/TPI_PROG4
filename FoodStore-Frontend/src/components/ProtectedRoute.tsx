import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores/authStore'
import { SpinnerCenter } from './Spinner'

interface Props { children: React.ReactNode; roles?: string[] }
export function ProtectedRoute({ children, roles }: Props) {
  const { usuario, isLoading } = useAuthStore()
  if (isLoading) return <SpinnerCenter />
  if (!usuario) return <Navigate to="/login" replace />
  if (roles && !roles.some(r => usuario.roles.includes(r))) return <Navigate to="/" replace />
  return <>{children}</>
}
