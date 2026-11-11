import { ShieldCheck, Users, Settings, BookOpen, MessageCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function OwnerDashboard() {
  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">PLATFORM ADMINISTRATION</p>
          <h1>Platform Owner</h1>
        </div>

        <button className="avatar" type="button">
          CN
        </button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">OWNER CONTROL CENTRE</p>
          <h2>Manage OLP Homework Hub.</h2>
          <p className="muted">
            Control users, roles, resources and platform settings.
          </p>
        </div>

        <ShieldCheck size={36} />
      </section>

      <section className="content-grid">
        <div className="panel quick">
          <h3>Platform management</h3>

          <Link className="secondary" to="/owner/teachers">
            <Users size={17} />
            <span>
              <strong>Teachers Forum</strong>
              <small>Contact teachers and manage their access</small>
            </span>
          </Link>

          <Link className="secondary" to="/owner/support">
            <MessageCircle size={17} />
            <span><strong>Teacher Support</strong><small>Reply to teachers in the support chat</small></span>
          </Link>

          <Link className="secondary" to="/owner/users">
            <Users size={17} />
            <span>
              <strong>Users & Roles</strong>
              <small>Manage teachers, students and administrators</small>
            </span>
          </Link>

          <button type="button">
            <BookOpen size={17} />
            <span>
              <strong>Resources</strong>
              <small>Manage shared learning resources</small>
            </span>
          </button>

          <button type="button">
            <Settings size={17} />
            <span>
              <strong>Platform Settings</strong>
              <small>Configure OLP Homework Hub</small>
            </span>
          </button>
        </div>

        <div className="panel quick">
          <h3>Teacher community</h3>
          <p>Reach teachers directly by email, see who has access and suspend or restore a teacher account when needed.</p>
          <Link className="primary" to="/owner/teachers"><Users size={17} /> Open Teachers Forum</Link>
          <Link className="secondary" to="/owner/support"><MessageCircle size={17} /> Open teacher support chat</Link>
        </div>
      </section>
    </main>
  )
}
