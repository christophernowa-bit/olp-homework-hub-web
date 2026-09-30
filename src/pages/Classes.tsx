import { useEffect, useMemo, useState } from 'react'
import { BookOpen, Copy, Edit3, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type ClassRow = {
  id: string
  name: string
  curriculum: string | null
  level: string | null
  academic_year: number | null
  description: string | null
  class_code: string
  is_active: boolean
  created_by: string
}

type SubjectRow = {
  id: string
  class_id: string
  name: string
  description: string | null
}

type StudentRosterRow = {
  enrolment_id: string
  student_id: string
  full_name: string
  email: string
  status: string
  enrolled_at: string
}

const blank = {
  name: '',
  curriculum: '',
  level: '',
  academicYear: String(new Date().getFullYear()),
  description: '',
}

function newCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let value = 'OLP-'
  for (let i = 0; i < 6; i += 1) value += chars[Math.floor(Math.random() * chars.length)]
  return value
}

function TeacherClasses() {
  const [userId, setUserId] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [enrolments, setEnrolments] = useState<{ class_id: string; status: string }[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(blank)
  const [subjectName, setSubjectName] = useState('')
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [studentRoster, setStudentRoster] = useState<StudentRosterRow[]>([])
  const [rosterLoading, setRosterLoading] = useState(false)
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null)

  const selected = classes.find((item) => item.id === selectedId) ?? null
  const selectedSubjects = subjects.filter((item) => item.class_id === selectedId)
  const studentCount = enrolments.filter(
    (item) => item.class_id === selectedId && item.status === 'active',
  ).length

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return classes
    return classes.filter((item) =>
      [item.name, item.curriculum, item.level, item.academic_year, item.class_code]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [classes, search])

  async function load(uid: string) {
    const classResult = await supabase
      .from('classes')
      .select('*')
      .eq('created_by', uid)
      .order('created_at', { ascending: false })

    if (classResult.error) throw classResult.error

    // Classes are the primary data for this page. Show them immediately
    // even if a secondary subjects/enrolments query has a problem.
    setClasses((classResult.data ?? []) as ClassRow[])

    const [subjectResult, enrolmentResult] = await Promise.all([
      supabase
        .from('class_subjects')
        .select('id,class_id,name,description')
        .eq('created_by', uid)
        .order('created_at'),
      supabase
        .from('class_enrolments')
        .select('class_id,status'),
    ])

    if (subjectResult.error) {
      console.error('Could not load class subjects:', subjectResult.error)
      setSubjects([])
    } else {
      setSubjects((subjectResult.data ?? []) as SubjectRow[])
    }

    if (enrolmentResult.error) {
      console.error('Could not load class enrolments:', enrolmentResult.error)
      setEnrolments([])
    } else {
      setEnrolments(enrolmentResult.data ?? [])
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) throw new Error('You must be signed in.')

        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('role').eq('id', user.id).single()

        if (profileError) throw profileError
        if (profile.role !== 'teacher') throw new Error('Teacher access is required.')

        setUserId(user.id)
        await load(user.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load classes.')
      }
    })()
  }, [])

  function openCreate() {
    setEditingId(null)
    setForm({ ...blank, academicYear: String(new Date().getFullYear()) })
    setShowForm(true)
    setError('')
    setMessage('')
  }

  function openEdit(item: ClassRow) {
    setEditingId(item.id)
    setForm({
      name: item.name,
      curriculum: item.curriculum ?? '',
      level: item.level ?? '',
      academicYear: item.academic_year?.toString() ?? '',
      description: item.description ?? '',
    })
    setShowForm(true)
  }

  async function saveClass(event: React.FormEvent) {
    event.preventDefault()
    const name = form.name.trim()
    const year = form.academicYear.trim() ? Number(form.academicYear) : null

    if (!name) return setError('Class name is required.')
    if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100)) {
      return setError('Academic year must be between 1900 and 2100.')
    }

    try {
      setBusy(true)
      setError('')
      const values = {
        name,
        curriculum: form.curriculum.trim() || null,
        level: form.level.trim() || null,
        academic_year: year,
        description: form.description.trim() || null,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error: updateError } = await supabase.from('classes').update(values).eq('id', editingId)
        if (updateError) throw updateError
        setMessage('Class updated successfully.')
      } else {
        let created = false
        let lastError: any = null
        for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
          const { error: insertError } = await supabase.from('classes').insert({
            ...values,
            created_by: userId,
            class_code: newCode(),
          })
          if (!insertError) created = true
          else if (insertError.code === '23505') lastError = insertError
          else throw insertError
        }
        if (!created) throw lastError ?? new Error('Could not create a unique class code.')
        setMessage('Class created successfully.')
      }

      setShowForm(false)
      setEditingId(null)
      await load(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save class.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleClass(item: ClassRow) {
    const { error: updateError } = await supabase
      .from('classes')
      .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    if (updateError) return setError(updateError.message)
    setMessage(item.is_active ? 'Class deactivated.' : 'Class activated.')
    await load(userId)
  }

  async function removeClass(item: ClassRow) {
    if (!window.confirm(`Delete "${item.name}" and its subjects/enrolments?`)) return
    const { error: deleteError } = await supabase.from('classes').delete().eq('id', item.id)
    if (deleteError) return setError(deleteError.message)
    if (selectedId === item.id) setSelectedId(null)
    setMessage('Class deleted successfully.')
    await load(userId)
  }

  async function addSubject(event: React.FormEvent) {
    event.preventDefault()
    if (!selected || !subjectName.trim()) return
    const { error: insertError } = await supabase.from('class_subjects').insert({
      class_id: selected.id,
      name: subjectName.trim(),
      created_by: userId,
    })
    if (insertError) return setError(insertError.message)
    setSubjectName('')
    setMessage('Subject added successfully.')
    await load(userId)
  }

  async function removeSubject(item: SubjectRow) {
    if (!window.confirm(`Delete "${item.name}"?`)) return
    const { error: deleteError } = await supabase.from('class_subjects').delete().eq('id', item.id)
    if (deleteError) return setError(deleteError.message)
    setMessage('Subject deleted successfully.')
    await load(userId)
  }

  async function callClassStudents(method: 'GET' | 'DELETE', classId: string, studentId?: string) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Your session has expired. Please sign in again.')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    const params = new URLSearchParams({ class_id: classId })
    if (studentId) params.set('student_id', studentId)

    const response = await fetch(`${supabaseUrl}/functions/v1/class-students?${params.toString()}`, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Request failed.')
    return result
  }

  async function loadStudentRoster(classId: string) {
    try {
      setRosterLoading(true)
      const result = await callClassStudents('GET', classId)
      setStudentRoster((result.students ?? []) as StudentRosterRow[])
    } catch (err) {
      setStudentRoster([])
      setError(err instanceof Error ? err.message : 'Could not load students.')
    } finally {
      setRosterLoading(false)
    }
  }

  async function openClass(classId: string) {
    setSelectedId(classId)
    setError('')
    setMessage('')
    await loadStudentRoster(classId)
  }

  async function removeStudent(student: StudentRosterRow) {
    if (!selected) return
    const label = student.full_name || student.email || 'this student'
    if (!window.confirm(`Remove ${label} from "${selected.name}"?`)) return

    try {
      setRemovingStudentId(student.student_id)
      setError('')
      setMessage('')
      await callClassStudents('DELETE', selected.id, student.student_id)
      setMessage(`${label} removed from the class.`)
      await Promise.all([load(userId), loadStudentRoster(selected.id)])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove student.')
    } finally {
      setRemovingStudentId(null)
    }
  }

  function formatEnrolledDate(value: string) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString()
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setMessage(`Class code ${code} copied.`)
    } catch {
      setError(`Copy failed. Class code: ${code}`)
    }
  }

  if (selected) {
    return (
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">TEACHER WORKSPACE</p><h1>{selected.name}</h1></div>
          <button className="profile" type="button">CN</button>
        </header>

        <button className="secondary" type="button" onClick={() => setSelectedId(null)}>← Back to classes</button>
        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}

        <section className="welcome class-detail-hero">
          <div>
            <p className="eyebrow">CLASS OVERVIEW</p>
            <h2>{selected.name}</h2>
            <p className="muted">
              {[selected.curriculum, selected.level, selected.academic_year].filter(Boolean).join(' · ') || 'Custom class'}
            </p>
            {selected.description && <p>{selected.description}</p>}
          </div>
          <div className="class-code-box">
            <span>Student join code</span>
            <strong>{selected.class_code}</strong>
            <button className="secondary" type="button" onClick={() => void copyCode(selected.class_code)}>
              <Copy size={15} /> Copy code
            </button>
          </div>
        </section>

        <section className="stats">
          <div className="card"><span>Subjects</span><strong>{selectedSubjects.length}</strong><small>In this class</small></div>
          <div className="card"><span>Students</span><strong>{studentCount}</strong><small>Active enrolments</small></div>
          <div className="card"><span>Status</span><strong className="class-status-text">{selected.is_active ? 'Active' : 'Inactive'}</strong><small>Class availability</small></div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading"><div><h3>Subjects</h3><p>Add any subject you teach.</p></div></div>
            <form className="class-subject-form" onSubmit={addSubject}>
              <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g. Mathematics" />
              <button className="primary" type="submit"><Plus size={15} /> Add subject</button>
            </form>
            <div className="class-subject-list">
              {selectedSubjects.length === 0 ? (
                <div className="empty-state class-empty"><BookOpen size={30} /><strong>No subjects yet</strong><p>Add the first subject for this class.</p></div>
              ) : selectedSubjects.map((subject) => (
                <div className="class-subject-row" key={subject.id}>
                  <strong>{subject.name}</strong>
                  <button className="icon-button" type="button" onClick={() => void removeSubject(subject)} title="Delete subject"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="panel-heading"><div><h3>Students</h3><p>{studentCount} {studentCount === 1 ? 'active student' : 'active students'}</p></div></div>
            {rosterLoading ? (
              <div className="empty-state class-empty"><Users size={30} /><strong>Loading students...</strong></div>
            ) : studentRoster.length === 0 ? (
              <div className="empty-state class-empty">
                <Users size={30} /><strong>No students yet</strong>
                <p>Share class code <strong>{selected.class_code}</strong> with your learners.</p>
              </div>
            ) : (
              <div className="class-student-list">
                {studentRoster.map((student) => (
                  <div className="class-student-row" key={student.enrolment_id}>
                    <div className="class-student-details">
                      <strong>{student.full_name || student.email || 'Unnamed student'}</strong>
                      <span>{student.email || 'No email available'}</span>
                      <small>{student.status === 'active' ? 'Active' : student.status} · Enrolled {formatEnrolledDate(student.enrolled_at)}</small>
                    </div>
                    <button className="secondary" type="button" disabled={removingStudentId === student.student_id} onClick={() => void removeStudent(student)}>
                      <Trash2 size={15} /> {removingStudentId === student.student_id ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">TEACHER WORKSPACE</p><h1>Classes</h1></div>
        <button className="profile" type="button">CN</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">CLASS MANAGEMENT</p>
          <h2>Organise your learners.</h2>
          <p className="muted">Create your own classes, add subjects and invite students with a class code.</p>
        </div>
        <button className="primary" type="button" onClick={openCreate}><Plus size={18} /> Create class</button>
      </section>

      {message && <p className="admin-message admin-message-success">{message}</p>}
      {error && <p className="admin-message admin-message-error">{error}</p>}

      {showForm && (
        <section className="panel class-form-panel">
          <div className="panel-heading">
            <div><h3>{editingId ? 'Edit class' : 'Create a class'}</h3><p>Use any curriculum, level or education system.</p></div>
            <button className="icon-button" type="button" onClick={() => setShowForm(false)}><X size={18} /></button>
          </div>
          <form className="class-form" onSubmit={saveClass}>
            <label><span>Class name *</span><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Stage 6 Cambridge" /></label>
            <label><span>Curriculum</span><input value={form.curriculum} onChange={(e) => setForm({ ...form, curriculum: e.target.value })} placeholder="e.g. Cambridge Primary" /></label>
            <label><span>Class / Level</span><input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="e.g. Stage 6" /></label>
            <label><span>Academic year</span><input type="number" min="1900" max="2100" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} /></label>
            <label className="class-form-description"><span>Description</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional class description" /></label>
            <div className="class-form-actions">
              <button className="secondary" type="button" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="primary" type="submit" disabled={busy}>{busy ? 'Saving...' : editingId ? 'Save changes' : 'Create class'}</button>
            </div>
          </form>
        </section>
      )}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading class-list-heading">
            <div><h3>Your classes</h3><p>{classes.length} {classes.length === 1 ? 'class' : 'classes'}</p></div>
            <div className="class-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes" /></div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state"><Users size={34} /><strong>No classes yet</strong><p>Create your first class to get started.</p></div>
          ) : (
            <div className="class-list">
              {filtered.map((item) => {
                const subjectCount = subjects.filter((s) => s.class_id === item.id).length
                const count = enrolments.filter((e) => e.class_id === item.id && e.status === 'active').length
                return (
                  <div className="class-item" key={item.id}>
                    <button className="class-item-main" type="button" onClick={() => void openClass(item.id)}>
                      <span className="class-item-icon"><Users size={19} /></span>
                      <span className="class-item-content">
                        <span className="class-item-title"><strong>{item.name}</strong><small>{item.is_active ? 'Active' : 'Inactive'}</small></span>
                        <span>{[item.curriculum, item.level, item.academic_year].filter(Boolean).join(' · ') || 'Custom class'}</span>
                        <small>{subjectCount} subjects · {count} students · Code: {item.class_code}</small>
                      </span>
                    </button>
                    <div className="class-row-actions">
                      <button type="button" title="Copy code" onClick={() => void copyCode(item.class_code)}><Copy size={15} /></button>
                      <button type="button" title="Edit" onClick={() => openEdit(item)}><Edit3 size={15} /></button>
                      <button type="button" onClick={() => void toggleClass(item)}>{item.is_active ? 'Pause' : 'Activate'}</button>
                      <button type="button" title="Delete" onClick={() => void removeClass(item)}><Trash2 size={15} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel quick">
          <h3>Class tools</h3>
          <button type="button" onClick={openCreate}><Plus size={17} /><span><strong>Create a class</strong><small>Any curriculum or level</small></span></button>
          <div className="class-help"><BookOpen size={17} /><span><strong>Subjects</strong><small>Open a class to add its subjects</small></span></div>
          <div className="class-help"><Users size={17} /><span><strong>Student joining</strong><small>Each class gets a unique join code</small></span></div>
        </div>
      </section>
    </main>
  )
}

function StudentClasses() {
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const selected = classes.find((item) => item.id === selectedId) ?? null
  const selectedSubjects = subjects.filter((item) => item.class_id === selectedId)

  async function loadStudentClasses() {
    const classResult = await supabase
      .from('classes')
      .select('*')
      .order('created_at', { ascending: false })

    if (classResult.error) throw classResult.error

    const rows = (classResult.data ?? []) as ClassRow[]
    setClasses(rows)

    if (rows.length === 0) {
      setSubjects([])
      return
    }

    const subjectResult = await supabase
      .from('class_subjects')
      .select('id,class_id,name,description')
      .in('class_id', rows.map((item) => item.id))
      .order('created_at')

    if (subjectResult.error) {
      console.error('Could not load class subjects:', subjectResult.error)
      setSubjects([])
    } else {
      setSubjects((subjectResult.data ?? []) as SubjectRow[])
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        await loadStudentClasses()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load your classes.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function joinClass(event: React.FormEvent) {
    event.preventDefault()
    const code = joinCode.trim()
    if (!code) return setError('Enter a class code.')

    try {
      setBusy(true)
      setError('')
      setMessage('')

      const { data, error: joinError } = await supabase.rpc('join_class_by_code', {
        p_class_code: code,
      })

      if (joinError) throw joinError

      await loadStudentClasses()
      setJoinCode('')
      setSelectedId(typeof data === 'string' ? data : null)
      setMessage('Class joined successfully.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join class.')
    } finally {
      setBusy(false)
    }
  }

  if (selected) {
    return (
      <main className="main">
        <header className="topbar">
          <div><p className="eyebrow">STUDENT WORKSPACE</p><h1>{selected.name}</h1></div>
          <button className="profile" type="button">ST</button>
        </header>

        <button className="secondary" type="button" onClick={() => setSelectedId(null)}>← Back to my classes</button>
        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}

        <section className="welcome class-detail-hero">
          <div>
            <p className="eyebrow">CLASS OVERVIEW</p>
            <h2>{selected.name}</h2>
            <p className="muted">
              {[selected.curriculum, selected.level, selected.academic_year].filter(Boolean).join(' · ') || 'Custom class'}
            </p>
            {selected.description && <p>{selected.description}</p>}
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading"><div><h3>Subjects</h3><p>Subjects available in this class.</p></div></div>
            <div className="class-subject-list">
              {selectedSubjects.length === 0 ? (
                <div className="empty-state class-empty"><BookOpen size={30} /><strong>No subjects yet</strong><p>Your teacher has not added subjects yet.</p></div>
              ) : selectedSubjects.map((subject) => (
                <div className="class-subject-row" key={subject.id}>
                  <strong>{subject.name}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="panel quick">
            <h3>Class access</h3>
            <div className="class-help"><Users size={17} /><span><strong>Enrolled</strong><small>You are an active member of this class.</small></span></div>
            <div className="class-help"><BookOpen size={17} /><span><strong>Resources</strong><small>Class resources will be connected next.</small></span></div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">STUDENT WORKSPACE</p><h1>Classes</h1></div>
        <button className="profile" type="button">ST</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">MY CLASSES</p>
          <h2>Join your class.</h2>
          <p className="muted">Enter the class code given to you by your teacher.</p>
        </div>
      </section>

      {message && <p className="admin-message admin-message-success">{message}</p>}
      {error && <p className="admin-message admin-message-error">{error}</p>}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading"><div><h3>My classes</h3><p>{classes.length} {classes.length === 1 ? 'class' : 'classes'}</p></div></div>
          {loading ? (
            <div className="empty-state"><Users size={34} /><strong>Loading classes...</strong></div>
          ) : classes.length === 0 ? (
            <div className="empty-state"><Users size={34} /><strong>No classes yet</strong><p>Use your teacher's class code to join your first class.</p></div>
          ) : (
            <div className="class-list">
              {classes.map((item) => {
                const subjectCount = subjects.filter((subject) => subject.class_id === item.id).length
                return (
                  <div className="class-item" key={item.id}>
                    <button className="class-item-main" type="button" onClick={() => setSelectedId(item.id)}>
                      <span className="class-item-icon"><Users size={19} /></span>
                      <span className="class-item-content">
                        <span className="class-item-title"><strong>{item.name}</strong><small>{item.is_active ? 'Active' : 'Inactive'}</small></span>
                        <span>{[item.curriculum, item.level, item.academic_year].filter(Boolean).join(' · ') || 'Custom class'}</span>
                        <small>{subjectCount} {subjectCount === 1 ? 'subject' : 'subjects'}</small>
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel quick">
          <h3>Join a class</h3>
          <form className="class-subject-form" onSubmit={joinClass}>
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="e.g. OLP-C7P8Y7"
              autoComplete="off"
            />
            <button className="primary" type="submit" disabled={busy}>
              <Plus size={15} /> {busy ? 'Joining...' : 'Join class'}
            </button>
          </form>
          <div className="class-help"><BookOpen size={17} /><span><strong>Class code</strong><small>Ask your teacher for the unique OLP class code.</small></span></div>
        </div>
      </section>
    </main>
  )
}

export default function Classes() {
  const [role, setRole] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) throw new Error('You must be signed in.')

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (profileError) throw profileError
        setRole(profile.role)
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
        <div className="empty-state"><Users size={34} /><strong>Loading classes...</strong></div>
      </main>
    )
  }

  if (role === 'student') return <StudentClasses />
  if (role === 'teacher') return <TeacherClasses />

  return (
    <main className="main">
      <header className="topbar"><div><p className="eyebrow">OLP WORKSPACE</p><h1>Classes</h1></div></header>
      <div className="empty-state"><Users size={34} /><strong>Classes are not available for this role yet.</strong></div>
    </main>
  )
}

