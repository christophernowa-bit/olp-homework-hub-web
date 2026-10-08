import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import {
  getCurrentUserRole,
  type UserRole,
} from '../lib/userRole'

type RoleRouteProps = {
  allowedRoles: UserRole[]
}

export default function RoleRoute({
  allowedRoles,
}: RoleRouteProps) {
  const [loading, setLoading] = useState(true)
  const [userRole, setUserRole] = useState<UserRole | null>(null)

  useEffect(() => {
    getCurrentUserRole()
      .then((role) => {
        setUserRole(role)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="auth-loading">
        Checking permissions...
      </div>
    )
  }

  if (!userRole) {
    return <Navigate to="/login" replace />
  }

  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
