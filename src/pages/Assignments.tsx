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
import WorkEditor, {
  emptyWorkDocument,
  normaliseWorkDocument,
  workDocumentToPlainText,
  type WorkDocument,
} from '../components/WorkEditor'

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
  content_json: unknown
  content_version: number
}

type SubmissionRow = {
  id: string
  assignment_id: string
  student_id: string
  text_response: string | null
  status: 'submitted' | 'marked' | 'returned'
  mark: number | null
  feedback: string | null
  submitted_at: string
  updated_at: string
  marked_by: string | null
  marked_at: string | null
  returned_at: string | null
  response_json: unknown
  response_version: number
}

type TeacherRosterRow = {
  enrolment_id: string
  student_id: string
  full_name: string
  email: string
  status: string
  enrolled_at: string
}

type AssignmentForm = {
  classId: string
  subjectId: string
  title: string
  dueAt: string
  totalMarks: string
  allowLate: boolean
}

const blankForm: AssignmentForm = {
  classId: '',
  subjectId: '',
  title: '',
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
  const [assignmentDocument, setAssignmentDocument] = useState<WorkDocument>(emptyWorkDocument)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | AssignmentRow['status']>('all')
  const [saving, setSaving] = useState(false)
  const [actionId, setActionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [reviewAssignmentId, setReviewAssignmentId] = useState<string | null>(null)
  const [reviewRoster, setReviewRoster] = useState<TeacherRosterRow[]>([])
  const [reviewSubmissions, setReviewSubmissions] = useState<SubmissionRow[]>([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null)

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
    setAssignmentDocument(emptyWorkDocument)
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
    setAssignmentDocument(
      normaliseWorkDocument(assignment.content_json, assignment.instructions ?? ''),
    )
    setForm({
      classId: assignment.class_id,
      subjectId: assignment.subject_id ?? '',
      title: assignment.title,
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
    setAssignmentDocument(emptyWorkDocument)
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
        instructions: workDocumentToPlainText(assignmentDocument) || null,
        content_json: assignmentDocument,
        content_version: 1,
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
      setAssignmentDocument(emptyWorkDocument)
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

  async function callClassStudents(classId: string) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Your session has expired. Please sign in again.')
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    const params = new URLSearchParams({ class_id: classId })

    const response = await fetch(
      `${supabaseUrl}/functions/v1/class-students?${params.toString()}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: publishableKey,
          'Content-Type': 'application/json',
        },
      },
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Could not load class students.')
    }

    return (result.students ?? []) as TeacherRosterRow[]
  }

  async function openSubmissionViewer(assignment: AssignmentRow) {
    try {
      setReviewAssignmentId(assignment.id)
      setReviewLoading(true)
      setReviewRoster([])
      setReviewSubmissions([])
      setExpandedSubmissionId(null)
      setMessage('')
      setError('')

      const [roster, submissionResult] = await Promise.all([
        callClassStudents(assignment.class_id),
        supabase
          .from('assignment_submissions')
          .select('*')
          .eq('assignment_id', assignment.id)
          .order('submitted_at', { ascending: false }),
      ])

      if (submissionResult.error) throw submissionResult.error

      setReviewRoster(roster.filter((student: TeacherRosterRow) => student.status === 'active'))
      setReviewSubmissions((submissionResult.data ?? []) as SubmissionRow[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load assignment submissions.',
      )
    } finally {
      setReviewLoading(false)
    }
  }

  function closeSubmissionViewer() {
    setReviewAssignmentId(null)
    setReviewRoster([])
    setReviewSubmissions([])
    setExpandedSubmissionId(null)
    setMessage('')
    setError('')
  }

  function reviewSubmissionFor(studentId: string) {
    return (
      reviewSubmissions.find((submission) => submission.student_id === studentId) ??
      null
    )
  }

  function reviewSubmissionLate(
    assignment: AssignmentRow,
    submission: SubmissionRow | null,
  ) {
    if (!submission || !assignment.due_at) return false

    return (
      new Date(submission.submitted_at).getTime() >
      new Date(assignment.due_at).getTime()
    )
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

  const reviewAssignment =
    assignments.find((assignment) => assignment.id === reviewAssignmentId) ?? null

  if (reviewAssignment) {
    const submittedCount = reviewRoster.filter((student) =>
      reviewSubmissionFor(student.student_id),
    ).length
    const notSubmittedCount = Math.max(reviewRoster.length - submittedCount, 0)

    return (
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              {workspaceRole === 'platform_owner'
                ? 'PLATFORM OWNER WORKSPACE'
                : 'TEACHER WORKSPACE'}
            </p>
            <h1>{reviewAssignment.title}</h1>
          </div>
          <button className="profile" type="button">
            {workspaceRole === 'platform_owner' ? 'PO' : 'TR'}
          </button>
        </header>

        <button
          className="secondary"
          type="button"
          onClick={closeSubmissionViewer}
        >
          ← Back to assignments
        </button>

        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}

        <section className="welcome assignment-review-hero">
          <div>
            <p className="eyebrow">ASSIGNMENT SUBMISSIONS</p>
            <h2>{reviewAssignment.title}</h2>
            <p className="muted">
              {className(reviewAssignment.class_id)} ·{' '}
              {subjectName(reviewAssignment.subject_id)}
            </p>
          </div>
          <span className={`assignment-status ${reviewAssignment.status}`}>
            {statusLabel(reviewAssignment.status)}
          </span>
        </section>

        <section className="stats">
          <div className="card">
            <span>Students</span>
            <strong>{reviewRoster.length}</strong>
            <small>Active enrolments</small>
          </div>
          <div className="card">
            <span>Submitted</span>
            <strong>{submittedCount}</strong>
            <small>Responses received</small>
          </div>
          <div className="card">
            <span>Not submitted</span>
            <strong>{notSubmittedCount}</strong>
            <small>Still outstanding</small>
          </div>
        </section>

        <section className="panel assignment-submissions-panel">
          <div className="panel-heading">
            <div>
              <h3>Student submissions</h3>
              <p>Open a submitted response to read the student's written work.</p>
            </div>
          </div>

          {reviewLoading ? (
            <div className="empty-state">
              <FileText size={34} />
              <strong>Loading submissions...</strong>
            </div>
          ) : reviewRoster.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={34} />
              <strong>No enrolled students</strong>
              <p>This class does not currently have active students.</p>
            </div>
          ) : (
            <div className="assignment-submission-list">
              {reviewRoster.map((student) => {
                const submission = reviewSubmissionFor(student.student_id)
                const isLate = reviewSubmissionLate(reviewAssignment, submission)
                const isExpanded =
                  submission?.id === expandedSubmissionId

                return (
                  <article
                    className="assignment-submission-row"
                    key={student.enrolment_id}
                  >
                    <div className="assignment-submission-student">
                      <strong>
                        {student.full_name || student.email || 'Unnamed student'}
                      </strong>
                      <span>{student.email || 'No email available'}</span>
                      <small>
                        {submission
                          ? `Submitted ${new Date(
                              submission.submitted_at,
                            ).toLocaleString()}`
                          : 'No submission received'}
                      </small>
                    </div>

                    <div className="assignment-submission-state">
                      {submission ? (
                        <>
                          <span
                            className={`assignment-student-status ${
                              isLate ? 'late' : 'submitted'
                            }`}
                          >
                            {isLate ? 'Late' : 'Submitted'}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSubmissionId(
                                isExpanded ? null : submission.id,
                              )
                            }
                          >
                            {isExpanded ? 'Hide response' : 'View response'}
                          </button>
                        </>
                      ) : (
                        <span className="assignment-student-status not-submitted">
                          Not submitted
                        </span>
                      )}
                    </div>

                    {submission && isExpanded && (
                      <div className="assignment-response-preview">
                        <div className="panel-heading">
                          <div>
                            <h3>Written response</h3>
                            <p>
                              Submitted{' '}
                              {new Date(
                                submission.submitted_at,
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <WorkEditor
                          value={normaliseWorkDocument(
                            submission.response_json,
                            submission.text_response ?? '',
                          )}
                          onChange={() => {}}
                          readOnly
                        />
                      </div>
                    )}
                  </article>
                )
              })}
            </div>
          )}
        </section>
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

            <div className="assignment-instructions-field">
              <span className="assignment-editor-label">Assignment content</span>
              <WorkEditor
                value={assignmentDocument}
                onChange={setAssignmentDocument}
                placeholder="Type instructions, questions or maths working..."
              />
            </div>

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
                    <button
                      type="button"
                      onClick={() => void openSubmissionViewer(assignment)}
                      disabled={busy || assignment.status === 'draft'}
                    >
                      <FileText size={14} /> View submissions
                    </button>

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

function StudentAssignments() {
  const [userId, setUserId] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [assignments, setAssignments] = useState<AssignmentRow[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [responseDocument, setResponseDocument] = useState<WorkDocument>(emptyWorkDocument)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'open' | 'submitted' | 'closed'>('all')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selected = assignments.find((item) => item.id === selectedId) ?? null
  const selectedSubmission =
    submissions.find((item) => item.assignment_id === selectedId) ?? null

  useEffect(() => {
    void (async () => {
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError) throw authError
        if (!user) throw new Error('You must be signed in.')

        setUserId(user.id)
        await loadStudentAssignments(user.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load assignments.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function loadStudentAssignments(uid: string) {
    const [assignmentResult, classResult, subjectResult, submissionResult] =
      await Promise.all([
        supabase
          .from('assignments')
          .select('*')
          .in('status', ['published', 'closed'])
          .order('due_at', { ascending: true, nullsFirst: false }),

        supabase
          .from('classes')
          .select('id,name,curriculum,level,academic_year,created_by,is_active')
          .order('name'),

        supabase
          .from('class_subjects')
          .select('id,class_id,name')
          .order('name'),

        supabase
          .from('assignment_submissions')
          .select('*')
          .eq('student_id', uid)
          .order('submitted_at', { ascending: false }),
      ])

    if (assignmentResult.error) throw assignmentResult.error
    if (classResult.error) throw classResult.error
    if (subjectResult.error) throw subjectResult.error
    if (submissionResult.error) throw submissionResult.error

    setAssignments((assignmentResult.data ?? []) as AssignmentRow[])
    setClasses((classResult.data ?? []) as ClassRow[])
    setSubjects((subjectResult.data ?? []) as SubjectRow[])
    setSubmissions((submissionResult.data ?? []) as SubmissionRow[])
  }

  function className(classId: string) {
    return classes.find((item) => item.id === classId)?.name ?? 'Class'
  }

  function subjectName(subjectId: string | null) {
    if (!subjectId) return 'Whole class'
    return subjects.find((item) => item.id === subjectId)?.name ?? 'Subject'
  }

  function submissionFor(assignmentId: string) {
    return submissions.find((item) => item.assignment_id === assignmentId) ?? null
  }

  function deadlinePassed(assignment: AssignmentRow) {
    return Boolean(
      assignment.due_at &&
        new Date(assignment.due_at).getTime() < Date.now(),
    )
  }

  function canSubmit(assignment: AssignmentRow) {
    if (assignment.status !== 'published') return false
    if (!deadlinePassed(assignment)) return true
    return assignment.allow_late_submissions
  }

  function isLateSubmission(
    assignment: AssignmentRow,
    submission: SubmissionRow | null,
  ) {
    if (!submission || !assignment.due_at) return false
    return (
      new Date(submission.submitted_at).getTime() >
      new Date(assignment.due_at).getTime()
    )
  }

  function studentStatus(assignment: AssignmentRow) {
    const submission = submissionFor(assignment.id)

    if (submission) {
      return isLateSubmission(assignment, submission)
        ? { label: 'Late', className: 'late' }
        : { label: 'Submitted', className: 'submitted' }
    }

    if (!canSubmit(assignment)) {
      return { label: 'Closed', className: 'closed' }
    }

    return { label: 'Not submitted', className: 'not-submitted' }
  }

  const filteredAssignments = useMemo(() => {
    const q = search.trim().toLowerCase()

    return assignments.filter((assignment) => {
      const status = studentStatus(assignment)

      if (filter === 'open' && !canSubmit(assignment)) return false
      if (filter === 'submitted' && !submissionFor(assignment.id)) return false
      if (filter === 'closed' && status.className !== 'closed') return false

      if (!q) return true

      return [
        assignment.title,
        assignment.instructions,
        className(assignment.class_id),
        subjectName(assignment.subject_id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [assignments, classes, subjects, submissions, search, filter])

  function openAssignment(assignment: AssignmentRow) {
    const submission = submissionFor(assignment.id)
    setSelectedId(assignment.id)
    setResponseDocument(normaliseWorkDocument(submission?.response_json, submission?.text_response ?? ''))
    setMessage('')
    setError('')
  }

  function closeAssignment() {
    if (saving) return
    setSelectedId(null)
    setResponseDocument(emptyWorkDocument)
    setMessage('')
    setError('')
  }

  async function submitTextResponse(event: React.FormEvent) {
    event.preventDefault()

    if (!selected) return
    if (!canSubmit(selected)) {
      return setError('This assignment is closed for submissions.')
    }

    const answer = workDocumentToPlainText(responseDocument).trim()
    if (!answer) {
      return setError('Write your response before submitting.')
    }

    try {
      setSaving(true)
      setError('')
      setMessage('')

      if (selectedSubmission) {
        const { error: updateError } = await supabase
          .from('assignment_submissions')
          .update({
            text_response: answer,
            response_json: responseDocument,
            response_version: 1,
          })
          .eq('id', selectedSubmission.id)

        if (updateError) throw updateError
        setMessage('Your submission has been updated.')
      } else {
        const { error: insertError } = await supabase
          .from('assignment_submissions')
          .insert({
            assignment_id: selected.id,
            student_id: userId,
            text_response: answer,
            response_json: responseDocument,
            response_version: 1,
          })

        if (insertError) throw insertError
        setMessage(
          deadlinePassed(selected)
            ? 'Your late submission has been sent.'
            : 'Your assignment has been submitted.',
        )
      }

      await loadStudentAssignments(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit assignment.')
    } finally {
      setSaving(false)
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

  if (selected) {
    const status = studentStatus(selected)
    const editable = canSubmit(selected)

    return (
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">STUDENT WORKSPACE</p>
            <h1>{selected.title}</h1>
          </div>
          <button className="profile" type="button">ST</button>
        </header>

        <button
          className="secondary"
          type="button"
          onClick={closeAssignment}
          disabled={saving}
        >
          ← Back to assignments
        </button>

        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}

        <section className="welcome assignment-student-hero">
          <div>
            <p className="eyebrow">ASSIGNMENT</p>
            <h2>{selected.title}</h2>
            <p className="muted">
              {className(selected.class_id)} · {subjectName(selected.subject_id)}
            </p>
          </div>

          <span className={`assignment-student-status ${status.className}`}>
            {status.label}
          </span>
        </section>

        <section className="stats">
          <div className="card">
            <span>Due</span>
            <strong className="assignment-stat-text">
              {selected.due_at ? new Date(selected.due_at).toLocaleDateString() : 'No date'}
            </strong>
            <small>{selected.due_at ? new Date(selected.due_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No deadline set'}</small>
          </div>

          <div className="card">
            <span>Total marks</span>
            <strong>{selected.total_marks}</strong>
            <small>Available marks</small>
          </div>

          <div className="card">
            <span>Late submissions</span>
            <strong className="assignment-stat-text">
              {selected.allow_late_submissions ? 'Allowed' : 'Not allowed'}
            </strong>
            <small>{deadlinePassed(selected) ? 'Deadline has passed' : 'Before deadline'}</small>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Instructions</h3>
                <p>Read carefully before submitting your work.</p>
              </div>
            </div>

            <div className="assignment-instructions">
              <WorkEditor
                value={normaliseWorkDocument(
                  selected.content_json,
                  selected.instructions ?? '',
                )}
                onChange={() => {}}
                readOnly
              />
            </div>
          </div>

          <div className="panel quick">
            <h3>Submission status</h3>

            <div className="class-help">
              <CheckCircle2 size={17} />
              <span>
                <strong>{status.label}</strong>
                <small>
                  {selectedSubmission
                    ? `Last submitted ${new Date(selectedSubmission.submitted_at).toLocaleString()}`
                    : editable
                      ? 'You can submit your response below.'
                      : 'This assignment is no longer accepting submissions.'}
                </small>
              </span>
            </div>

            {deadlinePassed(selected) && selected.allow_late_submissions && (
              <div className="class-help">
                <CalendarClock size={17} />
                <span>
                  <strong>Late submission window</strong>
                  <small>Submissions are still accepted and will be marked as late.</small>
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="panel assignment-submission-panel">
          <div className="panel-heading">
            <div>
              <h3>{selectedSubmission ? 'Your response' : 'Submit your work'}</h3>
              <p>
                {editable
                  ? selectedSubmission
                    ? 'You may update your written response while submissions remain open.'
                    : 'Type your written response below.'
                  : 'Your response is read-only because submissions are closed.'}
              </p>
            </div>
          </div>

          <form className="assignment-submission-form" onSubmit={submitTextResponse}>
            <WorkEditor
              value={responseDocument}
              onChange={setResponseDocument}
              readOnly={!editable || saving}
              placeholder="Write your answer or homework response here..."
            />

            <div className="assignment-submission-footer">
              <small>{workDocumentToPlainText(responseDocument).trim().length} characters</small>

              {editable && (
                <button className="primary" type="submit" disabled={saving}>
                  <CheckCircle2 size={16} />
                  {saving
                    ? 'Submitting...'
                    : selectedSubmission
                      ? 'Update submission'
                      : 'Submit assignment'}
                </button>
              )}
            </div>
          </form>
        </section>
      </main>
    )
  }

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
          <h2>Stay on top of your work.</h2>
          <p className="muted">
            Open assignments from your classes, read the instructions and submit your written work.
          </p>
        </div>
      </section>

      {message && <p className="admin-message admin-message-success">{message}</p>}
      {error && <p className="admin-message admin-message-error">{error}</p>}

      <section className="panel assignment-list-panel">
        <div className="panel-heading assignment-list-heading">
          <div>
            <h3>My assignments</h3>
            <p>{assignments.length} {assignments.length === 1 ? 'assignment' : 'assignments'}</p>
          </div>

          <div className="assignment-toolbar">
            <select
              value={filter}
              onChange={(event) =>
                setFilter(event.target.value as 'all' | 'open' | 'submitted' | 'closed')
              }
            >
              <option value="all">All assignments</option>
              <option value="open">Open for submission</option>
              <option value="submitted">Submitted</option>
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

        {filteredAssignments.length === 0 ? (
          <div className="empty-state">
            <FileText size={34} />
            <strong>No assignments found</strong>
            <p>
              Published assignments from your enrolled classes will appear here.
            </p>
          </div>
        ) : (
          <div className="assignment-list">
            {filteredAssignments.map((assignment) => {
              const status = studentStatus(assignment)
              const submission = submissionFor(assignment.id)

              return (
                <article className="assignment-item" key={assignment.id}>
                  <button
                    className="assignment-student-open"
                    type="button"
                    onClick={() => openAssignment(assignment)}
                  >
                    <div className="assignment-item-main">
                      <div className="assignment-item-title">
                        <strong>{assignment.title}</strong>
                        <span className={`assignment-student-status ${status.className}`}>
                          {status.label}
                        </span>
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
                        {assignment.allow_late_submissions && (
                          <span>Late submissions allowed</span>
                        )}
                      </div>

                      {submission && (
                        <small>
                          Submitted {new Date(submission.submitted_at).toLocaleString()}
                        </small>
                      )}
                    </div>

                    <span className="assignment-open-label">Open assignment</span>
                  </button>
                </article>
              )
            })}
          </div>
        )}
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
  if (role === 'student') return <StudentAssignments />

  return (
    <main className="main">
      <div className="empty-state">
        <FileText size={34} />
        <strong>Assignments are not available for this role yet.</strong>
      </div>
    </main>
  )
}
