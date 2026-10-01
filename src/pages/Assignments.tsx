import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Edit3,
  FileText,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type UserRole = 'platform_owner' | 'teacher' | 'student' | 'admin' | 'parent'

type ClassRow = {
  id: string
  name: string
  curriculum: string | null
  level: string | null
  academic_year: number | null
  created_by: string
  is_active: boolean
}

type SubjectRow = {
  id: string
  class_id: string
  name: string
}

type AssignmentRow = {
  id: string
  class_id: string
  subject_id: string | null
  created_by: string
  title: string
  instructions: string | null
  due_at: string | null
  total_marks: number
  status: 'draft' | 'published' | 'closed'
  allow_late_submissions: boolean
  published_at: string | null
  created_at: string
  updated_at: string
}

type AssignmentForm = {
  classId: string
  subjectId: string
  title: string
  instructions: string
  dueAt: string
  totalMarks: string
  allowLate: boolean
}

const blankForm: AssignmentForm = {
  classId: '',
  subjectId: '',
  title: '',
  instructions: '',
  dueAt: '',
  totalMarks: '10',
  allowLate: false,
}

function toLocalInput(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60_000)
  return local.toISOString().slice(0, 16)
}

function formatDue(value: string | null) {
  if (!value) return 'No due date'
  return new Date(value).toLocaleString()
}

function statusLabel(status: AssignmentRow['status']) {
  if (status === 'draft') return 'Draft'
  if (status === 'published') return 'Published'
  return 'Closed'
}

function TeacherAssignments({
  workspaceRole,
}: {
  workspaceRole: 'teacher' | 'platform_owner'
}) {
  const [userId, setUserId] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [form, setForm] = useState<AssignmentForm>(blankForm)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentRow['status']>('all')
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedClassSubjects = useMemo(
    () => subjects.filter((subject) => subject.class_id === form.classId),
    [subjects, form.classId],
  )

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase()

    return assignments.filter((assignment) => {
      if (statusFilter !== 'all' && assignment.status !== statusFilter) return false

      if (!q) return true

      const className = classes.find((item) => item.id === assignment.class_id)?.name ?? ''
      const subjectName =
        subjects.find((item) => item.id === assignment.subject_id)?.name ?? ''

      return [
        assignment.title,
        assignment.instructions,
        className,
        subjectName,
        assignment.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [assignments, classes, search, statusFilter, subjects])

  async function load(uid: string) {
    const [classResult, subjectResult, assignmentResult] = await Promise.all([
      supabase
        .from('classes')
        .select('id,name,curriculum,level,academic_year,created_by,is_active')
        .eq('created_by', uid)
        .order('created_at', { ascending: false }),

      supabase
        .from('class_subjects')
        .select('id,class_id,name')
        .eq('created_by', uid)
        .order('name'),

      supabase
        .from('assignments')
        .select('*')
        .eq('created_by', uid)
        .order('created_at', { ascending: false }),
    ])

    if (classResult.error) throw classResult.error
    if (subjectResult.error) throw subjectResult.error
    if (assignmentResult.error) throw assignmentResult.error

    setClasses((classResult.data ?? []) as ClassRow[])
    setSubjects((subjectResult.data ?? []) as SubjectRow[])
    setAssignments((assignmentResult.data ?? []) as AssignmentRow[])
  }

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError
        if (!user) throw new Error('You must be signed in.')

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError
        if (profile.role !== workspaceRole) {
          throw new Error(
            workspaceRole === 'platform_owner'
              ? 'Platform Owner access is required.'
              : 'Teacher access is required.',
          )
        }

        setUserId(user.id)
        await load(user.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load assignments.')
      } finally {
        setLoading(false)
      }
    })()
  }, [workspaceRole])

  function className(classId: string) {
    return classes.find((item) => item.id === classId)?.name ?? 'Class'
  }

  function subjectName(subjectId: string | null) {
    if (!subjectId) return 'Whole class'
    return subjects.find((item) => item.id === subjectId)?.name ?? 'Subject'
  }

  function openCreate() {
    const firstClass = classes.find((item) => item.is_active) ?? classes[0]

    setEditingId(null)
    setForm({
      ...blankForm,
      classId: firstClass?.id ?? '',
    })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  function openEdit(assignment: AssignmentRow) {
    setEditingId(assignment.id)
    setForm({
      classId: assignment.class_id,
      subjectId: assignment.subject_id ?? '',
      title: assignment.title,
      instructions: assignment.instructions ?? '',
      dueAt: toLocalInput(assignment.due_at),
      totalMarks: String(assignment.total_marks),
      allowLate: assignment.allow_late_submissions,
    })
    setShowForm(true)
    setMessage('')
    setError('')
  }

  function closeForm() {
    if (saving) return
    setShowForm(false)
    setEditingId(null)
    setForm(blankForm)
  }

  function changeClass(classId: string) {
    setForm((current) => ({
      ...current,
      classId,
      subjectId: '',
    }))
  }

  async function saveAssignment(event: React.FormEvent, targetStatus: 'draft' | 'published') {
    event.preventDefault()

    const title = form.title.trim()
    const totalMarks = Number(form.totalMarks)

    if (!form.classId) return setError('Choose a class.')
    if (!title) return setError('Assignment title is required.')
    if (!Number.isFinite(totalMarks) || totalMarks <= 0) {
      return setError('Total marks must be greater than zero.')
    }

    if (
      form.subjectId &&
      !selectedClassSubjects.some((subject) => subject.id === form.subjectId)
    ) {
      return setError('Choose a subject that belongs to the selected class.')
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

      const now = new Date().toISOString()
      const values = {
        class_id: form.classId,
        subject_id: form.subjectId || null,
        title,
        instructions: form.instructions.trim() || null,
        due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
        total_marks: totalMarks,
        allow_late_submissions: form.allowLate,
        status: targetStatus,
        published_at: targetStatus === 'published' ? now : null,
      }

      if (editingId) {
        const current = assignments.find((item) => item.id === editingId)

        const updateValues = {
          ...values,
          published_at:
            targetStatus === 'published'
              ? current?.published_at ?? now
              : null,
        }

        const { error: updateError } = await supabase
          .from('assignments')
          .update(updateValues)
          .eq('id', editingId)

        if (updateError) throw updateError

        setMessage(
          targetStatus === 'published'
            ? 'Assignment updated and published.'
            : 'Assignment saved as draft.',
        )
      } else {
        const { error: insertError } = await supabase.from('assignments').insert({
          ...values,
          created_by: userId,
        })

        if (insertError) throw insertError

        setMessage(
          targetStatus === 'published'
            ? 'Assignment created and published.'
            : 'Assignment saved as draft.',
        )
      }

      setShowForm(false)
      setEditingId(null)
      setForm(blankForm)
      await load(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save assignment.')
    } finally {
      setSaving(false)
    }
  }

  async function setAssignmentStatus(
    assignment: AssignmentRow,
    status: 'published' | 'closed',
  ) {
    try {
      setActionId(assignment.id)
      setError('')
      setMessage('')

      const now = new Date().toISOString()

      const { error: updateError } = await supabase
        .from('assignments')
        .update({
          status,
          published_at:
            status === 'published' ? assignment.published_at ?? now : assignment.published_at,
        })
        .eq('id', assignment.id)

      if (updateError) throw updateError

      setMessage(status === 'closed' ? 'Assignment closed.' : 'Assignment published.')
      await load(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update assignment.')
    } finally {
      setActionId(null)
    }
  }

  async function deleteAssignment(assignment: AssignmentRow) {
    if (
      !window.confirm(
        `Delete "${assignment.title}" permanently? Any submissions and attachment records linked to it will also be removed.`,
      )
    ) {
      return
    }

    try {
      setActionId(assignment.id)
      setError('')
      setMessage('')

      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', assignment.id)

      if (deleteError) throw deleteError

      setMessage('Assignment deleted.')
      await load(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete assignment.')
    } finally {
      setActionId(null)
    }
  }

  if (loading) {
    return (
      <main className="main">
        <div className="empty-state">
          <FileText size={34} />
          <strong>Loading assignments...</strong>
        </div>
      </main>
    )
  }

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            {workspaceRole === 'platform_owner'
              ? 'PLATFORM OWNER WORKSPACE'
              : 'TEACHER WORKSPACE'}
          </p>
          <h1>Assignments</h1>
        </div>
        <button className="profile" type="button">
          {workspaceRole === 'platform_owner' ? 'PO' : 'TR'}
        </button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">HOMEWORK & ASSIGNMENTS</p>
          <h2>Create meaningful homework.</h2>
          <p className="muted">
            Set work for one class and subject, choose a deadline and publish when ready.
          </p>
        </div>
        <button className="primary" type="button" onClick={openCreate}>
          <Plus size={18} /> Create assignment
        </button>
      </section>

      {message && <p className="admin-message admin-message-success">{message}</p>}
      {error && <p className="admin-message admin-message-error">{error}</p>}

      {showForm && (
        <section className="panel assignment-form-panel">
          <div className="panel-heading">
            <div>
              <h3>{editingId ? 'Edit assignment' : 'Create assignment'}</h3>
              <p>Save as a draft or publish immediately.</p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={closeForm}
              aria-label="Close assignment form"
            >
              <X size={18} />
            </button>
          </div>

          <form className="assignment-form">
            <label>
              <span>Class *</span>
              <select
                value={form.classId}
                onChange={(event) => changeClass(event.target.value)}
                disabled={Boolean(editingId && assignments.find((a) => a.id === editingId)?.status !== 'draft')}
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}{item.is_active ? '' : ' (Inactive)'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Subject</span>
              <select
                value={form.subjectId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    subjectId: event.target.value,
                  }))
                }
              >
                <option value="">Whole class</option>
                {selectedClassSubjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="assignment-title-field">
              <span>Title *</span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="e.g. Fractions revision exercise"
              />
            </label>

            <label>
              <span>Total marks *</span>
              <input
                type="number"
                min="1"
                step="1"
                value={form.totalMarks}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    totalMarks: event.target.value,
                  }))
                }
              />
            </label>

            <label>
              <span>Due date & time</span>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    dueAt: event.target.value,
                  }))
                }
              />
            </label>

            <label className="assignment-instructions-field">
              <span>Instructions</span>
              <textarea
                value={form.instructions}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    instructions: event.target.value,
                  }))
                }
                placeholder="Explain what learners must complete and submit."
              />
            </label>

            <label className="assignment-checkbox">
              <input
                type="checkbox"
                checked={form.allowLate}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    allowLate: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Allow late submissions</strong>
                <small>Students may still submit after the due date.</small>
              </span>
            </label>

            <div className="assignment-form-actions">
              <button className="secondary" type="button" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button
                className="secondary"
                type="button"
                disabled={saving}
                onClick={(event) => void saveAssignment(event as unknown as React.FormEvent, 'draft')}
              >
                {saving ? 'Saving...' : 'Save draft'}
              </button>
              <button
                className="primary"
                type="button"
                disabled={saving}
                onClick={(event) => void saveAssignment(event as unknown as React.FormEvent, 'published')}
              >
                <CheckCircle2 size={16} />
                {saving ? 'Publishing...' : editingId ? 'Save & publish' : 'Publish'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel assignment-list-panel">
        <div className="panel-heading assignment-list-heading">
          <div>
            <h3>My assignments</h3>
            <p>{assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}</p>
          </div>

          <div className="assignment-toolbar">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | AssignmentRow['status'])
              }
            >
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="closed">Closed</option>
            </select>

            <div className="assignment-search">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search assignments"
              />
            </div>
          </div>
        </div>

        {classes.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={34} />
            <strong>Create a class first</strong>
            <p>Assignments must belong to one of your classes.</p>
          </div>
        ) : filteredAssignments.length === 0 ? (
          <div className="empty-state">
            <FileText size={34} />
            <strong>No assignments found</strong>
            <p>Create your first assignment or change the current filters.</p>
          </div>
        ) : (
          <div className="assignment-list">
            {filteredAssignments.map((assignment) => {
              const busy = actionId === assignment.id
              const overdue =
                Boolean(assignment.due_at) &&
                new Date(assignment.due_at!).getTime() < Date.now() &&
                assignment.status === 'published'

              return (
                <article className="assignment-item" key={assignment.id}>
                  <div className="assignment-item-main">
                    <div className="assignment-item-title">
                      <strong>{assignment.title}</strong>
                      <span className={`assignment-status ${assignment.status}`}>
                        {statusLabel(assignment.status)}
                      </span>
                      {overdue && <span className="assignment-status overdue">Overdue</span>}
                    </div>

                    <p>
                      {className(assignment.class_id)} · {subjectName(assignment.subject_id)}
                    </p>

                    <div className="assignment-meta">
                      <span>
                        <CalendarClock size={14} />
                        {formatDue(assignment.due_at)}
                      </span>
                      <span>{assignment.total_marks} marks</span>
                      {assignment.allow_late_submissions && <span>Late submissions allowed</span>}
                    </div>

                    {assignment.instructions && <small>{assignment.instructions}</small>}
                  </div>

                  <div className="assignment-actions">
                    <button type="button" onClick={() => openEdit(assignment)} disabled={busy}>
                      <Edit3 size={14} /> Edit
                    </button>

                    {assignment.status === 'draft' && (
                      <button
                        type="button"
                        onClick={() => void setAssignmentStatus(assignment, 'published')}
                        disabled={busy}
                      >
                        Publish
                      </button>
                    )}

                    {assignment.status === 'published' && (
                      <button
                        type="button"
                        onClick={() => void setAssignmentStatus(assignment, 'closed')}
                        disabled={busy}
                      >
                        Close
                      </button>
                    )}

                    {assignment.status === 'closed' && (
                      <button
                        type="button"
                        onClick={() => void setAssignmentStatus(assignment, 'published')}
                        disabled={busy}
                      >
                        Reopen
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void deleteAssignment(assignment)}
                      disabled={busy}
                    >
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

function StudentAssignmentsPlaceholder() {
  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">STUDENT WORKSPACE</p>
          <h1>Assignments</h1>
        </div>
        <button className="profile" type="button">ST</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">HOMEWORK & ASSIGNMENTS</p>
          <h2>Your assignment workspace is being prepared.</h2>
          <p className="muted">
            Student viewing and submission tools will be enabled in the next phase.
          </p>
        </div>
      </section>
    </main>
  )
}

export default function Assignments() {
  const [role, setRole] = useState<UserRole | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError
        if (!user) throw new Error('You must be signed in.')

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError

        setRole(profile.role as UserRole)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your account.')
      }
    })()
  }, [])

  if (error) {
    return (
      <main className="main">
        <p className="admin-message admin-message-error">{error}</p>
      </main>
    )
  }

  if (!role) {
    return (
      <main className="main">
        <div className="empty-state">
          <FileText size={34} />
          <strong>Loading assignments...</strong>
        </div>
      </main>
    )
  }

  if (role === 'teacher') return <TeacherAssignments workspaceRole="teacher" />
  if (role === 'platform_owner') {
    return <TeacherAssignments workspaceRole="platform_owner" />
  }
  if (role === 'student') return <StudentAssignmentsPlaceholder />

  return (
    <main className="main">
      <div className="empty-state">
        <FileText size={34} />
        <strong>Assignments are not available for this role yet.</strong>
      </div>
    </main>
  )
}
