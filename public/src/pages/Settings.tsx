import { useEffect, useState } from 'react'
import { Bell, CheckCircle, Lock, Save, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getCurrentUserRole, type UserRole } from '../lib/userRole'

export default function Settings() {
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [connectionStatus, setConnectionStatus] = useState('Not tested')

  useEffect(() => {
    getCurrentUserRole().then(setUserRole)
  }, [])

  async function testSupabaseConnection() {
    setConnectionStatus('Testing...')

    try {
      const { error } = await supabase.auth.getSession()

      if (error) {
        setConnectionStatus(`Connection failed: ${error.message}`)
        return
      }

      setConnectionStatus('Connected to Supabase successfully')
    } catch {
      setConnectionStatus('Connection failed')
    }
  }

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
              <p>Your account details and permissions.</p>
            </div>
            <User size={22} />
          </div>

          <div className="empty-state">
            <User size={34} />

            <strong>
              {userRole === 'platform_owner'
                ? 'Platform Owner'
                : userRole ?? 'Loading role...'}
            </strong>

            <p>
              {userRole
                ? `Signed in with ${userRole.replace('_', ' ')} access.`
                : 'Loading your account permissions...'}
            </p>
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

          <button type="button" onClick={testSupabaseConnection}>
            <CheckCircle size={17} />
            <span>
              <strong>Test Supabase Connection</strong>
              <small>{connectionStatus}</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}
