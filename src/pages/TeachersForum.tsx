import { useEffect, useMemo, useState } from 'react'
import { Mail, Search, ShieldCheck, UserRound, UserX, UserCheck, Copy, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Teacher = {
  id: string
  email: string
  full_name: string
  role: 'teacher'
  created_at: string
  is_suspended: boolean
}

export default function TeachersForum() {
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [sendingWelcome, setSendingWelcome] = useState(false)

  async function loadTeachers() {
    setLoading(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please sign in again.')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-users`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load teachers.')
      setTeachers((result.users ?? []).filter((user: Teacher) => user.role === 'teacher'))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load teachers.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadTeachers() }, [])

  const filteredTeachers = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return teachers
    return teachers.filter((teacher) =>
      teacher.full_name.toLowerCase().includes(query) ||
      teacher.email.toLowerCase().includes(query),
    )
  }, [teachers, search])

  async function sendWelcomeEmails() {
    if (!window.confirm('Send the welcome and support email to teachers who have not received it yet?')) return
    setSendingWelcome(true)
    setError('')
    setNotice('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please sign in again.')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-users`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'send_missing_teacher_welcome_emails' }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to send welcome emails.')
      if (result.failed_count > 0 && result.sent_count === 0) {
        throw new Error(result.failures?.[0]?.error || 'Email delivery is not configured.')
      }
      setNotice(`Welcome emails sent: ${result.sent_count}. Already welcomed: ${result.skipped_count}. Failed: ${result.failed_count}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send welcome emails.')
    } finally {
      setSendingWelcome(false)
    }
  }

  async function changeAccess(teacher: Teacher) {
    const action = teacher.is_suspended ? 'restore_teacher' : 'deactivate_teacher'
    const actionLabel = teacher.is_suspended ? 'restore access to' : 'suspend access for'
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${teacher.full_name || teacher.email}? Their teaching access will ${teacher.is_suspended ? 'be restored' : 'be suspended'}; their existing submissions and records will be kept.`)) return

    setBusyId(teacher.id)
    setError('')
    setNotice('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please sign in again.')
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-users`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, user_id: teacher.id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to update teacher access.')
      setNotice(result.message || 'Teacher access updated.')
      await loadTeachers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update teacher access.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">PLATFORM ADMINISTRATION</p>
          <h1>Teachers Forum</h1>
        </div>
        <button className="avatar" type="button" aria-label="Platform owner">CN</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">TEACHER DIRECTORY</p>
          <h2>Connect with your teachers.</h2>
          <p className="muted">Email teachers directly and manage their platform access. Suspended accounts keep their previous work and can be restored later.</p>
        </div>
        <ShieldCheck size={36} aria-hidden="true" />
      </section>

      <p className="muted"><Link to="/owner">Platform Owner</Link> / Teachers Forum</p>
      {error && <div className="admin-message admin-message-error" role="alert">{error}</div>}
      {notice && <div className="admin-message admin-message-success" role="status">{notice}</div>}

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h3>Joined teachers</h3>
            <p>{loading ? 'Loading teacher accounts...' : `${teachers.length} teacher account${teachers.length === 1 ? '' : 's'}`}</p>
            <p>Welcome new and existing teachers, and invite them to ask for help in the in-app chat.</p>
          </div>
          <button className="primary" type="button" disabled={sendingWelcome} onClick={() => void sendWelcomeEmails()}>
            <Mail size={16} /> {sendingWelcome ? 'Sending...' : 'Send welcome emails'}
          </button>
          <div className="admin-search">
            <Search size={18} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search teachers" aria-label="Search teachers by name or email" />
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><UserRound size={34} /><strong>Loading teachers...</strong><p>Retrieving the teacher directory.</p></div>
        ) : filteredTeachers.length === 0 ? (
          <div className="empty-state"><UserRound size={34} /><strong>No teachers found</strong><p>{search ? 'Try another name or email.' : 'No teacher accounts have joined yet.'}</p></div>
        ) : (
          <div className="admin-user-list">
            {filteredTeachers.map((teacher) => (
              <article className="admin-user-row" key={teacher.id}>
                <div className="admin-user-details">
                  <strong>{teacher.full_name || 'Unnamed teacher'}</strong>
                  <span>{teacher.email || 'No email available'}</span>
                  <small>Joined {teacher.created_at ? new Date(teacher.created_at).toLocaleDateString() : '—'}</small>
                </div>
                <div className="admin-user-role">
                  <span className="admin-role-badge"><UserRound size={16} /> Teacher</span>
                  {teacher.is_suspended && <span className="admin-role-badge" aria-label="Access suspended">Access suspended</span>}
                  {teacher.email && (
                    <>
                      <a
                        className="secondary"
                        href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(teacher.email)}&su=${encodeURIComponent('OLP Homework Hub')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Mail size={15} /> Email teacher
                      </a>
                      <button
                        className="secondary"
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(teacher.email)
                            setCopiedEmail(teacher.email)
                            window.setTimeout(() => setCopiedEmail(null), 2000)
                          } catch {
                            setError('Could not copy the address. You can select the email shown on the teacher card and copy it.')
                          }
                        }}
                      >
                        {copiedEmail === teacher.email ? <Check size={15} /> : <Copy size={15} />}
                        {copiedEmail === teacher.email ? 'Copied' : 'Copy email'}
                      </button>
                    </>
                  )}
                  <button className={teacher.is_suspended ? 'primary' : 'secondary'} type="button" disabled={busyId === teacher.id} onClick={() => void changeAccess(teacher)}>
                    {teacher.is_suspended ? <UserCheck size={15} /> : <UserX size={15} />}
                    {busyId === teacher.id ? 'Updating...' : teacher.is_suspended ? 'Restore access' : 'Remove teacher'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
