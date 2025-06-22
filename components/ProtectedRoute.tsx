import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore, UserRole } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter()
  const { user, isAuthenticated } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login')
      return
    }

    if (allowedRoles && user?.role && !allowedRoles.includes(user.role)) {
      router.push('/unauthorized')
    }
  }, [isAuthenticated, user?.role, allowedRoles, router])

  if (!isAuthenticated || (allowedRoles && user?.role && !allowedRoles.includes(user.role))) {
    return null
  }

  return <>{children}</>
} 