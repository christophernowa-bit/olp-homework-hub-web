import { FormEvent, useEffect, useMemo, useState } from 'react'
import {
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type UserRole = 'platform_owner' | 'teacher' | 'student'

type PlatformUser = {
  id: string
  email: string
  full_name: string
  role: UserRole
  created_at: string
}

export default function UsersRoles() {
  const [users, setUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [search, setSearch] = useState('')

  const [showAddUser, setShowAddUser] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newFullName, setNewFullName] = useState('')
  const [newRole, setNewRole] = useState<'teacher' | 'student'>('teacher')
  const [creating, setCreating] = useState(false)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  async function callOwnerUsers(
    method: 'GET' | 'POST' | 'PATCH',
    body?: Record<string, unknown>,
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Your session has expired. Please sign in again.')
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const publishableKey =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

    const response = await fetch(
      `${supabaseUrl}/functions/v1/owner-users`,
      {
        method,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: publishableKey,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Request failed.')
    }

    return result
  }

  async function loadUsers() {
    setLoading(true)
    setError('')

    try {
      const result = await callOwnerUsers('GET')
      setUsers(result.users ?? [])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load users.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) {
      return users
    }

    return users.filter((user) => {
      return (
        user.email.toLowerCase().includes(query) ||
        user.full_name.toLowerCase().includes(query) ||
        user.role.toLowerCase().includes(query)
      )
    })
  }, [users, search])

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setCreating(true)
    setError('')
    setSuccess('')

    try {
      await callOwnerUsers('POST', {
        email: newEmail,
        full_name: newFullName,
        role: newRole,
      })

      setSuccess(`Invitation sent to ${newEmail}.`)
      setNewEmail('')
      setNewFullName('')
      setNewRole('teacher')
      setShowAddUser(false)

      await loadUsers()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create user.',
      )
    } finally {
      setCreating(false)
    }
  }

  async function handleRoleChange(
    user: PlatformUser,
    role: 'teacher' | 'student',
  ) {
    if (user.role === role) {
      return
    }

    setUpdatingUserId(user.id)
    setError('')
    setSuccess('')

    try {
      await callOwnerUsers('PATCH', {
        user_id: user.id,
        role,
      })

      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === user.id
            ? { ...currentUser, role }
            : currentUser,
        ),
      )

      setSuccess(`Role updated for ${user.email}.`)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update role.',
      )
    } finally {
      setUpdatingUserId(null)
    }
  }

  function formatRole(role: UserRole) {
    if (role === 'platform_owner') {
      return 'Platform Owner'
    }

    if (role === 'teacher') {
      return 'Teacher'
    }

    return 'Student'
  }

  function formatDate(value: string) {
    if (!value) {
      return '—'
    }

    return new Date(value).toLocaleDateString()
  }

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
            View users, invite new members and manage their roles.
          </p>
        </div>

        <button
          className="primary"
          type="button"
          onClick={() => setShowAddUser(true)}
        >
          <UserPlus size={18} />
          Add user
        </button>
      </section>

      {error && (
        <div className="admin-message admin-message-error">
          {error}
        </div>
      )}

      {success && (
        <div className="admin-message admin-message-success">
          {success}
        </div>
      )}

      {showAddUser && (
        <section className="panel admin-add-user">
          <div className="panel-heading">
            <div>
              <h3>Add user</h3>
              <p>Invite a Teacher or Student to OLP Homework Hub.</p>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={() => setShowAddUser(false)}
              aria-label="Close add user form"
            >
              <X size={20} />
            </button>
          </div>

          <form className="admin-user-form" onSubmit={handleCreateUser}>
            <label>
              Full name
              <input
                type="text"
                value={newFullName}
                onChange={(event) =>
                  setNewFullName(event.target.value)
                }
                placeholder="Full name"
              />
            </label>

            <label>
              Email address
              <input
                type="email"
                value={newEmail}
                onChange={(event) =>
                  setNewEmail(event.target.value)
                }
                placeholder="name@example.com"
                required
              />
            </label>

            <label>
              Role
              <select
                value={newRole}
                onChange={(event) =>
                  setNewRole(
                    event.target.value as 'teacher' | 'student',
                  )
                }
              >
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </label>

            <button
              className="primary"
              type="submit"
              disabled={creating}
            >
              <UserPlus size={18} />
              {creating ? 'Sending invitation...' : 'Invite user'}
            </button>
          </form>
        </section>
      )}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Platform users</h3>
              <p>
                {loading
                  ? 'Loading registered users...'
                  : `${users.length} registered user${
                      users.length === 1 ? '' : 's'
                    }`}
              </p>
            </div>

            <div className="admin-search">
              <Search size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search users"
                aria-label="Search users"
              />
            </div>
          </div>

          {loading ? (
            <div className="empty-state">
              <Users size={34} />
              <strong>Loading users...</strong>
              <p>Retrieving the OLP user directory.</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="empty-state">
              <Users size={34} />
              <strong>No users found</strong>
              <p>
                {search
                  ? 'Try another search.'
                  : 'No registered users are available.'}
              </p>
            </div>
          ) : (
            <div className="admin-user-list">
              {filteredUsers.map((user) => (
                <div className="admin-user-row" key={user.id}>
                  <div className="admin-user-details">
                    <strong>
                      {user.full_name || user.email || 'Unnamed user'}
                    </strong>

                    <span>{user.email || 'No email available'}</span>

                    <small>
                      Joined {formatDate(user.created_at)}
                    </small>
                  </div>

                  <div className="admin-user-role">
                    {user.role === 'platform_owner' ? (
                      <span className="admin-role-badge">
                        <ShieldCheck size={16} />
                        Platform Owner
                      </span>
                    ) : (
                      <select
                        value={user.role}
                        disabled={updatingUserId === user.id}
                        onChange={(event) =>
                          handleRoleChange(
                            user,
                            event.target.value as
                              | 'teacher'
                              | 'student',
                          )
                        }
                        aria-label={`Role for ${user.email}`}
                      >
                        <option value="teacher">Teacher</option>
                        <option value="student">Student</option>
                      </select>
                    )}

                    {updatingUserId === user.id && (
                      <small>Updating...</small>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel quick">
          <h3>Role management</h3>

          <div className="admin-role-summary">
            <ShieldCheck size={17} />
            <span>
              <strong>Platform Owner</strong>
              <small>Full platform administration</small>
            </span>
          </div>

          <div className="admin-role-summary">
            <Users size={17} />
            <span>
              <strong>Teacher</strong>
              <small>Teaching workspace access</small>
            </span>
          </div>

          <div className="admin-role-summary">
            <Users size={17} />
            <span>
              <strong>Student</strong>
              <small>Learner workspace access</small>
            </span>
          </div>

          <p className="muted">
            Platform Owner access cannot be changed from this page.
          </p>
        </div>
      </section>
    </main>
  )
}
