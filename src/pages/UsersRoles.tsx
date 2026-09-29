import {
  Search,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react'

export default function UsersRoles() {
  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">PLATFORM ADMINISTRATION</p>
          <h1>Users & Roles</h1>
        </div>

        <button className="avatar" type="button">
          CN
        </button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">USER MANAGEMENT</p>
          <h2>Manage platform access.</h2>
          <p className="muted">
            View users and manage their roles across OLP Homework Hub.
          </p>
        </div>

        <button className="primary" type="button">
          <UserPlus size={18} />
          Add user
        </button>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Platform users</h3>
              <p>Registered users will appear here.</p>
            </div>

            <button className="icon-button" type="button">
              <Search size={20} />
            </button>
          </div>

          <div className="empty-state">
            <Users size={34} />
            <strong>User directory</strong>
            <p>
              User accounts will be loaded securely from Supabase.
            </p>
          </div>
        </div>

        <div className="panel quick">
          <h3>Role management</h3>

          <button type="button">
            <ShieldCheck size={17} />
            <span>
              <strong>Platform Owner</strong>
              <small>Full platform administration</small>
            </span>
          </button>

          <button type="button">
            <Users size={17} />
            <span>
              <strong>Teacher</strong>
              <small>Teaching workspace access</small>
            </span>
          </button>

          <button type="button">
            <Users size={17} />
            <span>
              <strong>Student</strong>
              <small>Learner workspace access</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}
