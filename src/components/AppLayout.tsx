import {
  FileText,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

export default function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">OLP</div>

          <div>
            <strong>Homework Hub</strong>
            <span>Teacher workspace</span>
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
            to="/settings"
            className={({ isActive }) =>
              `nav-item${isActive ? ' active' : ''}`
            }
          >
            <Settings size={18} />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-note">
          <strong>OLP Homework Hub</strong>
          <p>Build better practice papers.</p>
        </div>
      </aside>

      <Outlet />
    </div>
  )
}
