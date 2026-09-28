import { Bell, Lock, Save, User } from 'lucide-react'

export default function Settings() {
  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">TEACHER WORKSPACE</p>
          <h1>Settings</h1>
        </div>
        <button className="avatar" type="button">CN</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">ACCOUNT SETTINGS</p>
          <h2>Manage your workspace.</h2>
          <p className="muted">
            Update your profile and workspace preferences.
          </p>
        </div>

        <button className="primary" type="button">
          <Save size={18} />
          Save changes
        </button>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Profile</h3>
              <p>Your account details will appear here.</p>
            </div>
            <User size={22} />
          </div>

          <div className="empty-state">
            <User size={34} />
            <strong>Teacher profile</strong>
            <p>Profile settings will be connected later.</p>
          </div>
        </div>

        <div className="panel quick">
          <h3>Preferences</h3>

          <button type="button">
            <Bell size={17} />
            <span>
              <strong>Notifications</strong>
              <small>Manage your alerts</small>
            </span>
          </button>

          <button type="button">
            <Lock size={17} />
            <span>
              <strong>Security</strong>
              <small>Password and account access</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}
