import { ShieldCheck, Users, Settings, BookOpen } from 'lucide-react'

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

          <button type="button">
            <Users size={17} />
            <span>
              <strong>Users & Roles</strong>
              <small>Manage teachers, students and administrators</small>
            </span>
          </button>

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

        <div className="panel">
          <div className="empty-state">
            <ShieldCheck size={34} />
            <strong>Platform Owner Access</strong>
            <p>
              Administrative tools will be added here as we build the platform.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
