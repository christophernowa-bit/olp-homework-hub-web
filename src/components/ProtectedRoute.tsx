import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute() {
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [authenticated, setAuthenticated] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthenticated(Boolean(data.session))
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(Boolean(session))
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="auth-loading">Loading OLP...</div>
  }

  if (!authenticated) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  return <Outlet />
}
