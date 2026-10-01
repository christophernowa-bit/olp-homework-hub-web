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

type AvailableResource = {
  id: string
  title: string
  description: string | null
  curriculum: string | null
  level: string | null
  year: number | null
  subject: string | null
  resource_type: string
  file_name: string | null
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  created_by: string
  is_published: boolean
  created_at: string
}

type ClassResourceAssignment = {
  id: string
  class_id: string
  subject_id: string | null
  resource_id: string
  assigned_by: string
  is_visible: boolean
  assigned_at: string
}

type StudentClassResource = {
  assignment_id: string
  subject_id: string | null
  class_subject: string | null
  assigned_at: string
  id: string
  title: string
  description: string | null
  curriculum: string | null
  level: string | null
  year: number | null
  subject: string | null
  resource_type: string
  file_name: string | null
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  signed_url: string | null
}

type CreatorProfile = {
  id: string
  full_name: string | null
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

function TeacherClasses({ workspaceRole }: { workspaceRole: 'teacher' | 'platform_owner' }) {
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
  const [availableResources, setAvailableResources] = useState<AvailableResource[]>([])
  const [resourceAssignments, setResourceAssignments] = useState<ClassResourceAssignment[]>([])
  const [resourceSubjectId, setResourceSubjectId] = useState('')
  const [resourceSearch, setResourceSearch] = useState('')
  const [resourcesLoading, setResourcesLoading] = useState(false)
  const [resourceBusyId, setResourceBusyId] = useState<string | null>(null)
  const [ownerView, setOwnerView] = useState<'my' | 'all'>('my')
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({})
  const [classBusyId, setClassBusyId] = useState<string | null>(null)
  const [subjectBusyId, setSubjectBusyId] = useState<string | null>(null)

  const selected = classes.find((item) => item.id === selectedId) ?? null
  const selectedSubjects = subjects.filter((item) => item.class_id === selectedId)
  const studentCount = enrolments.filter(
    (item) => item.class_id === selectedId && item.status === 'active',
  ).length
  const canManageSelected = Boolean(selected && selected.created_by === userId)

  const visibleClasses = useMemo(() => {
    if (workspaceRole !== 'platform_owner') return classes
    return ownerView === 'my'
      ? classes.filter((item) => item.created_by === userId)
      : classes
  }, [classes, ownerView, userId, workspaceRole])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return visibleClasses
    return visibleClasses.filter((item) =>
      [
        item.name,
        item.curriculum,
        item.level,
        item.academic_year,
        item.class_code,
        creatorNames[item.created_by],
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [visibleClasses, search, creatorNames])

  const filteredAvailableResources = useMemo(() => {
    const q = resourceSearch.trim().toLowerCase()
    if (!q) return availableResources

    return availableResources.filter((resource) =>
      [
        resource.title,
        resource.description,
        resource.curriculum,
        resource.level,
        resource.year,
        resource.subject,
        resource.resource_type,
        resource.file_name,
      ]
        .filter((value) => value !== null && value !== undefined)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [availableResources, resourceSearch])

  async function load(uid: string) {
    const classResult = workspaceRole === 'platform_owner'
      ? await supabase
          .from('classes')
          .select('*')
          .order('created_at', { ascending: false })
      : await supabase
          .from('classes')
          .select('*')
          .eq('created_by', uid)
          .order('created_at', { ascending: false })

    if (classResult.error) throw classResult.error

    const classRows = (classResult.data ?? []) as ClassRow[]
    setClasses(classRows)

    const subjectQuery = supabase
      .from('class_subjects')
      .select('id,class_id,name,description')
      .order('created_at')

    const [subjectResult, enrolmentResult] = await Promise.all([
      workspaceRole === 'platform_owner'
        ? subjectQuery
        : subjectQuery.eq('created_by', uid),
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

    if (workspaceRole === 'platform_owner' && classRows.length > 0) {
      const creatorIds = [...new Set(classRows.map((item) => item.created_by))]
      const { data: creatorRows, error: creatorError } = await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', creatorIds)

      if (creatorError) {
        console.error('Could not load class creators:', creatorError)
        setCreatorNames({})
      } else {
        const names: Record<string, string> = {}
        for (const profile of (creatorRows ?? []) as CreatorProfile[]) {
          names[profile.id] = profile.full_name?.trim() || 'Teacher'
        }
        setCreatorNames(names)
      }
    } else {
      setCreatorNames({})
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
        setError(err instanceof Error ? err.message : 'Could not load classes.')
      }
    })()
  }, [workspaceRole])

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
    try {
      setClassBusyId(item.id)
      setError('')
      const { error: updateError } = await supabase
        .from('classes')
        .update({ is_active: !item.is_active, updated_at: new Date().toISOString() })
        .eq('id', item.id)
      if (updateError) throw updateError
      setMessage(item.is_active ? 'Class deactivated.' : 'Class activated.')
      await load(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update class status.')
    } finally {
      setClassBusyId(null)
    }
  }

  async function removeClass(item: ClassRow) {
    const confirmed = window.confirm(
      `Delete "${item.name}" permanently? This removes its subjects, enrolments and class resource assignments.`,
    )
    if (!confirmed) return

    try {
      setClassBusyId(item.id)
      setError('')
      const { error: deleteError } = await supabase.from('classes').delete().eq('id', item.id)
      if (deleteError) throw deleteError
      if (selectedId === item.id) setSelectedId(null)
      setMessage('Class deleted successfully.')
      await load(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete class.')
    } finally {
      setClassBusyId(null)
    }
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
    if (!window.confirm(`Delete "${item.name}" from this class? Any subject-specific resource assignments will also be removed.`)) return

    try {
      setSubjectBusyId(item.id)
      setError('')
      const { error: deleteError } = await supabase.from('class_subjects').delete().eq('id', item.id)
      if (deleteError) throw deleteError
      setMessage('Subject deleted successfully.')
      await load(userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete subject.')
    } finally {
      setSubjectBusyId(null)
    }
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
    const classItem = classes.find((item) => item.id === classId)
    setSelectedId(classId)
    setError('')
    setMessage('')
    setResourceSearch('')
    setResourceSubjectId('')
    await Promise.all([
      loadStudentRoster(classId),
      loadClassResources(classId, classItem?.created_by === userId),
    ])
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

  async function callClassResources(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    classId: string,
    body?: Record<string, unknown>,
  ) {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Your session has expired. Please sign in again.')

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    const url = method === 'GET'
      ? `${supabaseUrl}/functions/v1/class-resources?class_id=${encodeURIComponent(classId)}`
      : `${supabaseUrl}/functions/v1/class-resources`

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: publishableKey,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify({ class_id: classId, ...body }) } : {}),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || 'Class resource request failed.')
    return result
  }

  async function loadClassResources(classId: string, ownedByCurrentUser = true) {
    try {
      setResourcesLoading(true)

      if (workspaceRole === 'platform_owner' && !ownedByCurrentUser) {
        const { data: assignmentRows, error: assignmentError } = await supabase
          .from('class_resources')
          .select('id,class_id,subject_id,resource_id,assigned_by,is_visible,assigned_at')
          .eq('class_id', classId)
          .order('assigned_at', { ascending: false })

        if (assignmentError) throw assignmentError

        const assignments = (assignmentRows ?? []) as ClassResourceAssignment[]
        setResourceAssignments(assignments)

        const resourceIds = [...new Set(assignments.map((item) => item.resource_id))]
        if (resourceIds.length === 0) {
          setAvailableResources([])
          return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error('Your session has expired. Please sign in again.')

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-resources`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          },
        )

        const ownerResourceResult = await response.json()
        if (!response.ok) {
          throw new Error(ownerResourceResult.error || 'Could not load resource details for inspection.')
        }

        const assignedSet = new Set(resourceIds)
        const resourceRows = (ownerResourceResult.resources ?? []).filter(
          (resource: AvailableResource) => assignedSet.has(resource.id),
        )
        setAvailableResources(resourceRows as AvailableResource[])
        return
      }

      const result = await callClassResources('GET', classId)
      setAvailableResources((result.available_resources ?? []) as AvailableResource[])
      setResourceAssignments((result.assignments ?? []) as ClassResourceAssignment[])
    } catch (err) {
      setAvailableResources([])
      setResourceAssignments([])
      setError(err instanceof Error ? err.message : 'Could not load class resources.')
    } finally {
      setResourcesLoading(false)
    }
  }

  async function assignResource(resource: AvailableResource) {
    if (!selected) return

    try {
      setResourceBusyId(resource.id)
      setError('')
      setMessage('')

      await callClassResources('POST', selected.id, {
        resource_id: resource.id,
        subject_id: resourceSubjectId || null,
      })

      setMessage(`"${resource.title}" assigned successfully.`)
      await loadClassResources(selected.id, selected.created_by === userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign resource.')
    } finally {
      setResourceBusyId(null)
    }
  }

  async function toggleResourceVisibility(assignment: ClassResourceAssignment) {
    if (!selected) return

    try {
      setResourceBusyId(assignment.id)
      setError('')
      setMessage('')

      await callClassResources('PATCH', selected.id, {
        assignment_id: assignment.id,
        is_visible: !assignment.is_visible,
      })

      setMessage(
        assignment.is_visible
          ? 'Resource hidden from students.'
          : 'Resource is now visible to students.',
      )
      await loadClassResources(selected.id, selected.created_by === userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update resource visibility.')
    } finally {
      setResourceBusyId(null)
    }
  }

  async function removeResourceAssignment(assignment: ClassResourceAssignment) {
    if (!selected) return

    const resource = availableResources.find((item) => item.id === assignment.resource_id)
    const label = resource?.title || 'this resource'
    if (!window.confirm(`Remove "${label}" from this class? Students will no longer see this assignment.`)) return

    try {
      setResourceBusyId(assignment.id)
      setError('')
      setMessage('')

      await callClassResources('DELETE', selected.id, {
        assignment_id: assignment.id,
      })

      setMessage(`"${label}" removed from the class.`)
      await loadClassResources(selected.id, selected.created_by === userId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove class resource.')
    } finally {
      setResourceBusyId(null)
    }
  }

  function assignmentSubjectName(subjectId: string | null) {
    if (!subjectId) return 'Whole class'
    return selectedSubjects.find((subject) => subject.id === subjectId)?.name ?? 'Subject'
  }

  function resourceForAssignment(assignment: ClassResourceAssignment) {
    return availableResources.find((resource) => resource.id === assignment.resource_id) ?? null
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
          <div><p className="eyebrow">{workspaceRole === 'platform_owner' ? 'PLATFORM OWNER WORKSPACE' : 'TEACHER WORKSPACE'}</p><h1>{selected.name}</h1></div>
          <button className="profile" type="button">{workspaceRole === 'platform_owner' ? 'PO' : 'CN'}</button>
        </header>

        <button className="secondary" type="button" onClick={() => setSelectedId(null)}>← Back to classes</button>
        {message && <p className="admin-message admin-message-success">{message}</p>}
        {error && <p className="admin-message admin-message-error">{error}</p>}
        {workspaceRole === 'platform_owner' && !canManageSelected && (
          <p className="admin-message">
            Inspection mode: this class belongs to {creatorNames[selected.created_by] || 'another teacher'}. You can inspect subjects, students and assigned resources without changing the teacher's class.
          </p>
        )}

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
            <div className="panel-heading"><div><h3>Subjects</h3><p>{canManageSelected ? 'Add or remove subjects for this class.' : 'Subjects configured by the class teacher.'}</p></div></div>
            {canManageSelected && (
              <form className="class-subject-form" onSubmit={addSubject}>
                <input value={subjectName} onChange={(e) => setSubjectName(e.target.value)} placeholder="e.g. Mathematics" />
                <button className="primary" type="submit"><Plus size={15} /> Add subject</button>
              </form>
            )}
            <div className="class-subject-list">
              {selectedSubjects.length === 0 ? (
                <div className="empty-state class-empty"><BookOpen size={30} /><strong>No subjects yet</strong><p>Add the first subject for this class.</p></div>
              ) : selectedSubjects.map((subject) => (
                <div className="class-subject-row" key={subject.id}>
                  <strong>{subject.name}</strong>
                  {canManageSelected && (
                    <button className="icon-button" type="button" disabled={subjectBusyId === subject.id} onClick={() => void removeSubject(subject)} title="Delete subject"><Trash2 size={15} /></button>
                  )}
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
                    {canManageSelected && (
                      <button className="secondary" type="button" disabled={removingStudentId === student.student_id} onClick={() => void removeStudent(student)}>
                        <Trash2 size={15} /> {removingStudentId === student.student_id ? 'Removing...' : 'Remove'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel class-detail-hero">
          <div className="panel-heading">
            <div>
              <h3>Class Resources</h3>
              <p>{canManageSelected ? 'Assign learning materials to the whole class or to a specific subject.' : 'Resources currently assigned by the class teacher.'}</p>
            </div>
          </div>

          {canManageSelected ? (
            <>
              <div className="resource-form">
                <label>
                  <span>Assign to</span>
                  <select value={resourceSubjectId} onChange={(e) => setResourceSubjectId(e.target.value)}>
                    <option value="">Whole class</option>
                    {selectedSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>{subject.name}</option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Find a resource</span>
                  <input value={resourceSearch} onChange={(e) => setResourceSearch(e.target.value)} placeholder="Search title, subject or type" />
                </label>
              </div>

              <div className="content-grid">
                <div>
                  <div className="panel-heading"><div><h3>Available Resources</h3><p>{filteredAvailableResources.length} available</p></div></div>
                  {resourcesLoading ? (
                    <div className="empty-state class-empty"><BookOpen size={30} /><strong>Loading resources...</strong></div>
                  ) : filteredAvailableResources.length === 0 ? (
                    <div className="empty-state class-empty"><BookOpen size={30} /><strong>No resources available</strong><p>Add or publish resources in the Resource Centre first.</p></div>
                  ) : (
                    <div className="resource-list">
                      {filteredAvailableResources.map((resource) => {
                        const alreadyAssigned = resourceAssignments.some(
                          (assignment) => assignment.resource_id === resource.id && (assignment.subject_id ?? '') === resourceSubjectId,
                        )
                        return (
                          <div className="resource-item" key={resource.id}>
                            <div className="resource-item-content">
                              <div className="resource-item-title">
                                <strong>{resource.title}</strong>
                                <span className={`resource-status ${resource.is_published ? 'published' : 'draft'}`}>{resource.is_published ? 'Published' : 'Draft'}</span>
                              </div>
                              <p>{[resource.subject, resource.resource_type, resource.year].filter(Boolean).join(' · ') || 'Learning resource'}</p>
                              {resource.description && <small>{resource.description}</small>}
                            </div>
                            <div className="resource-actions">
                              <button type="button" disabled={alreadyAssigned || resourceBusyId === resource.id} onClick={() => void assignResource(resource)}>
                                <Plus size={14} /> {alreadyAssigned ? 'Assigned' : resourceBusyId === resource.id ? 'Assigning...' : 'Assign'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div>
                  <div className="panel-heading"><div><h3>Assigned Resources</h3><p>{resourceAssignments.length} assigned</p></div></div>
                  {resourceAssignments.length === 0 ? (
                    <div className="empty-state class-empty"><BookOpen size={30} /><strong>No resources assigned</strong><p>Choose a resource from the available list.</p></div>
                  ) : (
                    <div className="resource-list">
                      {resourceAssignments.map((assignment) => {
                        const resource = resourceForAssignment(assignment)
                        return (
                          <div className="resource-item" key={assignment.id}>
                            <div className="resource-item-content">
                              <div className="resource-item-title">
                                <strong>{resource?.title ?? 'Resource'}</strong>
                                <span className={`resource-status ${assignment.is_visible ? 'published' : 'draft'}`}>{assignment.is_visible ? 'Visible' : 'Hidden'}</span>
                              </div>
                              <p>{assignmentSubjectName(assignment.subject_id)}</p>
                              {resource?.resource_type && <small>{resource.resource_type}</small>}
                            </div>
                            <div className="resource-actions">
                              <button type="button" disabled={resourceBusyId === assignment.id} onClick={() => void toggleResourceVisibility(assignment)}>{assignment.is_visible ? 'Hide' : 'Show'}</button>
                              <button type="button" disabled={resourceBusyId === assignment.id} onClick={() => void removeResourceAssignment(assignment)}><Trash2 size={14} /> Remove</button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : resourcesLoading ? (
            <div className="empty-state class-empty"><BookOpen size={30} /><strong>Loading assigned resources...</strong></div>
          ) : resourceAssignments.length === 0 ? (
            <div className="empty-state class-empty"><BookOpen size={30} /><strong>No resources assigned</strong><p>This teacher has not assigned resources to the class yet.</p></div>
          ) : (
            <div className="resource-list">
              {resourceAssignments.map((assignment) => {
                const resource = resourceForAssignment(assignment)
                return (
                  <div className="resource-item" key={assignment.id}>
                    <div className="resource-item-content">
                      <div className="resource-item-title">
                        <strong>{resource?.title ?? 'Resource'}</strong>
                        <span className={`resource-status ${assignment.is_visible ? 'published' : 'draft'}`}>{assignment.is_visible ? 'Visible' : 'Hidden'}</span>
                      </div>
                      <p>{assignmentSubjectName(assignment.subject_id)}</p>
                      {resource?.resource_type && <small>{resource.resource_type}</small>}
                    </div>
                  </div>
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
        <div><p className="eyebrow">{workspaceRole === 'platform_owner' ? 'PLATFORM OWNER WORKSPACE' : 'TEACHER WORKSPACE'}</p><h1>Classes</h1></div>
        <button className="profile" type="button">{workspaceRole === 'platform_owner' ? 'PO' : 'CN'}</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">{workspaceRole === 'platform_owner' ? 'CLASS OVERSIGHT' : 'CLASS MANAGEMENT'}</p>
          <h2>{workspaceRole === 'platform_owner' ? 'Manage and inspect classes.' : 'Organise your learners.'}</h2>
          <p className="muted">
            {workspaceRole === 'platform_owner'
              ? 'Manage classes you created and inspect every teacher class across OLP.'
              : 'Create your own classes, add subjects and invite students with a class code.'}
          </p>
        </div>
        <button className="primary" type="button" onClick={openCreate}><Plus size={18} /> Create class</button>
      </section>

      {workspaceRole === 'platform_owner' && (
        <section className="panel class-form-panel">
          <div className="class-row-actions" style={{ justifyContent: 'flex-start' }}>
            <button className={ownerView === 'my' ? 'primary' : 'secondary'} type="button" onClick={() => { setOwnerView('my'); setSearch('') }}>My Classes</button>
            <button className={ownerView === 'all' ? 'primary' : 'secondary'} type="button" onClick={() => { setOwnerView('all'); setSearch('') }}>All Classes</button>
          </div>
        </section>
      )}

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
            <div>
              <h3>{workspaceRole === 'platform_owner' && ownerView === 'all' ? 'All classes' : 'Your classes'}</h3>
              <p>{visibleClasses.length} {visibleClasses.length === 1 ? 'class' : 'classes'}</p>
            </div>
            <div className="class-search"><Search size={16} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search classes" /></div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty-state"><Users size={34} /><strong>No classes found</strong><p>{workspaceRole === 'platform_owner' && ownerView === 'all' ? 'No teacher classes are available for inspection yet.' : 'Create your first class to get started.'}</p></div>
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
                        <small>
                          {subjectCount} subjects · {count} students · Code: {item.class_code}
                          {workspaceRole === 'platform_owner' && ownerView === 'all'
                            ? ` · ${item.created_by === userId ? 'Mine' : creatorNames[item.created_by] || 'Teacher'}`
                            : ''}
                        </small>
                      </span>
                    </button>
                    <div className="class-row-actions">
                      {item.created_by === userId ? (
                        <>
                          <button type="button" title="Copy code" onClick={() => void copyCode(item.class_code)}><Copy size={15} /></button>
                          <button type="button" title="Edit" disabled={classBusyId === item.id} onClick={() => openEdit(item)}><Edit3 size={15} /></button>
                          <button type="button" disabled={classBusyId === item.id} onClick={() => void toggleClass(item)}>{classBusyId === item.id ? 'Working...' : item.is_active ? 'Pause' : 'Activate'}</button>
                          <button type="button" title="Delete" disabled={classBusyId === item.id} onClick={() => void removeClass(item)}><Trash2 size={15} /></button>
                        </>
                      ) : (
                        <button type="button" onClick={() => void openClass(item.id)}>Inspect</button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="panel quick">
          <h3>{workspaceRole === 'platform_owner' ? 'Oversight tools' : 'Class tools'}</h3>
          <button type="button" onClick={openCreate}><Plus size={17} /><span><strong>Create a class</strong><small>Any curriculum or level</small></span></button>
          <div className="class-help"><BookOpen size={17} /><span><strong>{workspaceRole === 'platform_owner' ? 'Inspect classes' : 'Subjects'}</strong><small>{workspaceRole === 'platform_owner' ? 'Use All Classes to inspect teacher classes' : 'Open a class to add its subjects'}</small></span></div>
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
  const [classResources, setClassResources] = useState<StudentClassResource[]>([])
  const [resourcesLoading, setResourcesLoading] = useState(false)

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

  async function loadStudentResources(classId: string) {
    try {
      setResourcesLoading(true)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please sign in again.')

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      const response = await fetch(
        `${supabaseUrl}/functions/v1/class-resources?class_id=${encodeURIComponent(classId)}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: publishableKey,
            'Content-Type': 'application/json',
          },
        },
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load class resources.')

      setClassResources((result.resources ?? []) as StudentClassResource[])
    } catch (err) {
      setClassResources([])
      setError(err instanceof Error ? err.message : 'Could not load class resources.')
    } finally {
      setResourcesLoading(false)
    }
  }

  async function openStudentClass(classId: string) {
    setSelectedId(classId)
    setError('')
    setMessage('')
    await loadStudentResources(classId)
  }

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

      if (typeof data === 'string') {
        setSelectedId(data)
        await loadStudentResources(data)
      } else {
        setSelectedId(null)
      }

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
            <div className="class-help"><BookOpen size={17} /><span><strong>Resources</strong><small>{classResources.length} {classResources.length === 1 ? 'resource' : 'resources'} available.</small></span></div>
          </div>
        </section>

        <section className="panel class-detail-hero">
          <div className="panel-heading">
            <div>
              <h3>Learning Resources</h3>
              <p>Materials assigned to this class by your teacher.</p>
            </div>
          </div>

          {resourcesLoading ? (
            <div className="empty-state class-empty">
              <BookOpen size={30} />
              <strong>Loading resources...</strong>
            </div>
          ) : classResources.length === 0 ? (
            <div className="empty-state class-empty">
              <BookOpen size={30} />
              <strong>No resources yet</strong>
              <p>Your teacher has not assigned any visible resources to this class.</p>
            </div>
          ) : (
            <div className="resource-list">
              {classResources.map((resource) => (
                <div className="resource-item" key={resource.assignment_id}>
                  <div className="resource-item-content">
                    <div className="resource-item-title">
                      <strong>{resource.title}</strong>
                      {resource.class_subject && (
                        <span className="resource-status published">{resource.class_subject}</span>
                      )}
                    </div>
                    <p>
                      {[resource.resource_type, resource.subject, resource.year]
                        .filter(Boolean)
                        .join(' · ') || 'Learning resource'}
                    </p>
                    {resource.description && <small>{resource.description}</small>}
                  </div>
                  <div className="resource-actions">
                    {resource.signed_url ? (
                      <button
                        type="button"
                        onClick={() => window.open(resource.signed_url!, '_blank', 'noopener,noreferrer')}
                      >
                        <BookOpen size={14} /> Open
                      </button>
                    ) : (
                      <button type="button" disabled>No file</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    <button className="class-item-main" type="button" onClick={() => void openStudentClass(item.id)}>
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
  if (role === 'teacher') return <TeacherClasses workspaceRole="teacher" />
  if (role === 'platform_owner') return <TeacherClasses workspaceRole="platform_owner" />

  return (
    <main className="main">
      <header className="topbar"><div><p className="eyebrow">OLP WORKSPACE</p><h1>Classes</h1></div></header>
      <div className="empty-state"><Users size={34} /><strong>Classes are not available for this role yet.</strong></div>
    </main>
  )
}

