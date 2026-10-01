import { useEffect, useState } from 'react'
import {
  BookOpen,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Settings,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  getCurrentUserRole,
  type UserRole,
} from '../lib/userRole'

function workspaceLabel(role: UserRole | null) {
  if (role === 'platform_owner') return 'Platform Owner workspace'
  if (role === 'teacher') return 'Teacher workspace'
  if (role === 'student') return 'Student workspace'
  if (role === 'admin') return 'Admin workspace'
  if (role === 'parent') return 'Parent workspace'
  return 'OLP workspace'
}

export default function AppLayout() {
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    getCurrentUserRole().then(setUserRole)
  }, [])

  async function handleLogout() {
    if (loggingOut) return

    try {
      setLoggingOut(true)
      await supabase.auth.signOut()
    } finally {
      navigate('/login', { replace: true })
      window.location.reload()
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OLP</div>

          <div>
            <strong>Homework Hub</strong>
            <span>{workspaceLabel(userRole)}</span>
          </div>
        </div>

        <nav className="nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          <NavLink
            to="/exams"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <FileText size={18} />
            Exams
          </NavLink>

          <NavLink
            to="/classes"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <Users size={18} />
            Classes
          </NavLink>

          <NavLink
            to="/assignments"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <ClipboardList size={18} />
            Assignments
          </NavLink>

          <NavLink
            to="/discussions"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <MessageCircle size={18} />
            Discussions
          </NavLink>

          <NavLink
            to="/resources"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <BookOpen size={18} />
            Resource Centre
          </NavLink>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <Settings size={18} />
            Settings
          </NavLink>

          {userRole === 'platform_owner' && (
            <NavLink
              to="/owner"
              className={({ isActive }) =>
                `nav-item${isActive ? ' active' : ''}`
              }
            >
              <ShieldCheck size={18} />
              Platform Owner
            </NavLink>
          )}
        </nav>

        <div className="sidebar-account">
          <span>{workspaceLabel(userRole)}</span>
          <button
            type="button"
            className="sidebar-logout"
            onClick={() => void handleLogout()}
            disabled={loggingOut}
          >
            <LogOut size={17} />
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>

        <div className="sidebar-note">
          <strong>OLP Homework Hub</strong>
          <p>Learn • Submit • Discuss • Grow</p>
        </div>
      </aside>

      <Outlet />
    </div>
  )
}
