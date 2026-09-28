import {
  FileText,
  LayoutDashboard,
  Plus,
  Search,
  Settings,
  Upload,
  Users,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'

export default function Exams() {
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
          <NavLink className="nav-item" to="/">
            <LayoutDashboard size={18} />
            Dashboard
          </NavLink>

          <NavLink className="nav-item active" to="/exams">
            <FileText size={18} />
            Exams
          </NavLink>

          <NavLink className="nav-item" to="/classes">
            <Users size={18} />
            Classes
          </NavLink>

          <NavLink className="nav-item" to="/settings">
            <Settings size={18} />
            Settings
          </NavLink>
        </nav>

        <div className="sidebar-note">
          <strong>OLP Homework Hub</strong>
          <p>Create, organise and manage your practice papers.</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Teacher workspace</p>
            <h1>Exams</h1>
          </div>
          <button className="avatar" type="button">CN</button>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow">Exam library</p>
            <h2>Your practice papers.</h2>
            <p className="muted">
              Create, import, edit and organise exams from one place.
            </p>
          </div>

          <button className="primary" type="button">
            <Plus size={18} />
            Create exam
          </button>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>All exams</h3>
                <p>Your saved exams will appear here.</p>
              </div>

              <button className="icon-button" type="button">
                <Search size={18} />
              </button>
            </div>

            <div className="empty-state">
              <FileText size={32} />
              <strong>No exams yet</strong>
              <p>Create or import your first practice paper.</p>
            </div>
          </div>

          <div className="panel quick">
            <h3>Exam tools</h3>

            <button type="button">
              <Plus size={17} />
              <span>
                <strong>Create an exam</strong>
                <small>Build a new paper from scratch</small>
              </span>
            </button>

            <button type="button">
              <Upload size={17} />
              <span>
                <strong>Import a paper</strong>
                <small>Upload an existing exam paper</small>
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
