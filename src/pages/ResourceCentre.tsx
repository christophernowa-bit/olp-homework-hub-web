import { useEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Download,
  Edit3,
  Eye,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Share2,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  curriculumOptions,
  resourceTypeOptions,
  resourceYears,
  subjectOptions,
} from '../resourceOptions'

type Resource = {
  id: string
  title: string
  description: string | null
  curriculum: string
  level: string
  year: number | null
  subject: string
  resource_type: string
  file_name: string | null
  file_path: string | null
  file_size: number | null
  mime_type: string | null
  created_by: string
  is_published: boolean
  created_at: string
  updated_at: string
  signed_url?: string | null
}

type UserRole = 'platform_owner' | 'teacher' | 'student'

type TeacherProfile = {
  id: string
  displayName: string
}

type ResourceForm = {
  title: string
  description: string
  curriculum: string
  customCurriculum: string
  level: string
  customLevel: string
  subject: string
  customSubject: string
  year: string
  resource_type: string
  is_published: boolean
}

const emptyForm: ResourceForm = {
  title: '',
  description: '',
  curriculum: '',
  customCurriculum: '',
  level: '',
  customLevel: '',
  subject: '',
  customSubject: '',
  year: '',
  resource_type: 'document',
  is_published: true,
}

export default function ResourceCentre() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Resource | null>(null)
  const [form, setForm] = useState<ResourceForm>(emptyForm)
  const [file, setFile] = useState<File | null>(null)
  const [files, setFiles] = useState<File[]>([])
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)

  const [shareResource, setShareResource] = useState<Resource | null>(null)
  const [teachers, setTeachers] = useState<TeacherProfile[]>([])
  const [sharedTeacherIds, setSharedTeacherIds] = useState<string[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    initialiseResourceCentre()
  }, [])

  const selectedCurriculum = useMemo(
    () =>
      curriculumOptions.find(
        (option) => option.name === form.curriculum,
      ),
    [form.curriculum],
  )

  const levelOptions = selectedCurriculum?.levels ?? []

  function actualCurriculum() {
    return form.curriculum === 'Other'
      ? form.customCurriculum.trim()
      : form.curriculum.trim()
  }

  function actualLevel() {
    return form.level === 'Other'
      ? form.customLevel.trim()
      : form.level.trim()
  }

  function actualSubject() {
    return form.subject === 'Other'
      ? form.customSubject.trim()
      : form.subject.trim()
  }

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!session?.access_token) {
      throw new Error(
        'Your session has expired. Please sign in again.',
      )
    }

    return session.access_token
  }

  async function getCurrentIdentity() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Unable to verify the signed-in user.')
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      throw new Error('Unable to load your user profile.')
    }

    if (
      profile.role !== 'platform_owner' &&
      profile.role !== 'teacher' &&
      profile.role !== 'student'
    ) {
      throw new Error('Resource Centre access is not available for this role.')
    }

    return {
      userId: user.id,
      role: profile.role as UserRole,
    }
  }

  async function callResources(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    role: UserRole,
    body?: Record<string, unknown>,
  ) {
    const token = await getAccessToken()
    if (role === 'student') throw new Error('Student resources are loaded from enrolled classes.')
    const functionName = role === 'platform_owner' ? 'owner-resources' : 'teacher-resources'

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      },
    )

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'Resource request failed.')
    }

    return result
  }

  async function loadStudentResources(userId: string) {
    const token = await getAccessToken()
    const { data: enrolments, error: enrolmentError } = await supabase
      .from('class_enrolments')
      .select('class_id')
      .eq('student_id', userId)
      .eq('status', 'active')
    if (enrolmentError) throw enrolmentError
    const classIds = [...new Set((enrolments ?? []).map((row) => row.class_id))]
    const collected: Resource[] = []
    for (const classId of classIds) {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/class-resources?class_id=${encodeURIComponent(classId)}`, { headers: { Authorization: `Bearer ${token}` } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to load class resources.')
      for (const resource of result.resources ?? []) {
        collected.push({ ...resource, created_by: '', is_published: true, created_at: resource.assigned_at ?? '', updated_at: resource.assigned_at ?? '' })
      }
    }
    const unique = Array.from(new Map(collected.map((resource) => [resource.id, resource])).values())
    setResources(unique)
  }

  async function initialiseResourceCentre() {
    setLoading(true)
    setError('')

    try {
      const identity = await getCurrentIdentity()
      setCurrentUserId(identity.userId)
      setCurrentRole(identity.role)

      if (identity.role === 'student') {
        await loadStudentResources(identity.userId)
      } else {
        const result = await callResources('GET', identity.role)
        setResources(result.resources ?? [])
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load resources.',
      )
    } finally {
      setLoading(false)
    }
  }

  async function loadResources() {
    if (!currentRole) return

    setLoading(true)
    setError('')

    try {
      if (currentRole === 'student') {
        await loadStudentResources(currentUserId)
      } else {
        const result = await callResources('GET', currentRole)
        setResources(result.resources ?? [])
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load resources.',
      )
    } finally {
      setLoading(false)
    }
  }

  function canManageResource(resource: Resource) {
    return (
      currentRole === 'platform_owner' ||
      (
        currentRole === 'teacher' &&
        resource.created_by === currentUserId
      )
    )
  }

  function openAddForm() {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    setFiles([])
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function resolveExistingCurriculum(value: string) {
    return curriculumOptions.some(
      (option) => option.name === value,
    )
      ? value
      : 'Other'
  }

  function resolveExistingSubject(value: string) {
    return subjectOptions.includes(value)
      ? value
      : 'Other'
  }

  function openEditForm(resource: Resource) {
    const curriculumChoice =
      resolveExistingCurriculum(resource.curriculum)

    const curriculumDefinition =
      curriculumOptions.find(
        (option) =>
          option.name === curriculumChoice,
      )

    const knownLevel =
      curriculumChoice !== 'Other' &&
      curriculumDefinition?.levels.includes(resource.level)

    const subjectChoice =
      resolveExistingSubject(resource.subject)

    setEditing(resource)

    setForm({
      title: resource.title,
      description: resource.description ?? '',
      curriculum: curriculumChoice,
      customCurriculum:
        curriculumChoice === 'Other'
          ? resource.curriculum
          : '',
      level: knownLevel ? resource.level : 'Other',
      customLevel:
        knownLevel ? '' : resource.level,
      subject: subjectChoice,
      customSubject:
        subjectChoice === 'Other'
          ? resource.subject
          : '',
      year:
        resource.year === null
          ? ''
          : String(resource.year),
      resource_type: resource.resource_type,
      is_published: resource.is_published,
    })

    setFile(null)
    setFiles([])
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function closeForm() {
    if (saving) return

    setShowForm(false)
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    setFiles([])
  }

  function handleCurriculumChange(value: string) {
    setForm((current) => ({
      ...current,
      curriculum: value,
      customCurriculum:
        value === 'Other'
          ? current.customCurriculum
          : '',
      level: '',
      customLevel: '',
    }))
  }

  function handleLevelChange(value: string) {
    setForm((current) => ({
      ...current,
      level: value,
      customLevel:
        value === 'Other'
          ? current.customLevel
          : '',
    }))
  }

  function handleSubjectChange(value: string) {
    setForm((current) => ({
      ...current,
      subject: value,
      customSubject:
        value === 'Other'
          ? current.customSubject
          : '',
    }))
  }

  async function uploadFile(selectedFile: File) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error(
        'Unable to verify the signed-in user.',
      )
    }

    const safeName = selectedFile.name.replace(
      /[^a-zA-Z0-9._-]/g,
      '_',
    )

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}-${safeName}`

    const filePath = `${user.id}/${uniqueName}`

    const { error: uploadError } =
      await supabase.storage
        .from('resources')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false,
          contentType:
            selectedFile.type ||
            'application/octet-stream',
        })

    if (uploadError) {
      throw uploadError
    }

    return {
      filePath,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      mimeType:
        selectedFile.type ||
        'application/octet-stream',
    }
  }

  async function removeUploadedFile(
    filePath: string,
  ) {
    await supabase.storage
      .from('resources')
      .remove([filePath])
  }

  function detectedYearFromName(name: string) {
    const matches = name.match(/(?:19|20)\d{2}/g) ?? []
    const years = matches.map(Number).filter((year) => year >= 1990 && year <= 2100)
    return years.length === 1 ? years[0] : null
  }

  function titleFromFileName(name: string) {
    return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  }

  async function saveBulkResources(curriculum: string, level: string, subject: string) {
    const uploadedPaths: string[] = []
    try {
      for (const selectedFile of files) {
        const details = await uploadFile(selectedFile)
        uploadedPaths.push(details.filePath)
        const detectedYear = detectedYearFromName(selectedFile.name)
        await callResources('POST', currentRole!, {
          title: titleFromFileName(selectedFile.name),
          description: form.description.trim(),
          curriculum, level, subject,
          year: detectedYear ?? (form.year === '' ? null : Number(form.year)),
          resource_type: form.resource_type,
          is_published: form.is_published,
          file_name: details.fileName, file_path: details.filePath,
          file_size: details.fileSize, mime_type: details.mimeType,
        })
        uploadedPaths.splice(uploadedPaths.indexOf(details.filePath), 1)
      }
      return files.length
    } catch (error) {
      for (const path of uploadedPaths) await removeUploadedFile(path)
      throw error
    }
  }

  async function handleSave(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    setSaving(true)
    setError('')
    setMessage('')

    let newlyUploadedPath: string | null = null

    try {
      if (!currentRole) {
        throw new Error('Your Resource Centre session is not ready.')
      }

      const curriculum = actualCurriculum()
      const level = actualLevel()
      const subject = actualSubject()

      if (
        (!editing && files.length > 0 ? false : !form.title.trim()) ||
        !curriculum ||
        !level ||
        !subject
      ) {
        throw new Error(
          'Title, curriculum, class/level and subject are required.',
        )
      }

      if (!editing && files.length > 0) {
        const count = await saveBulkResources(curriculum, level, subject)
        setMessage(`${count} resource${count === 1 ? '' : 's'} uploaded and organised successfully.`)
        setShowForm(false); setEditing(null); setForm(emptyForm); setFile(null); setFiles([])
        await loadResources()
        return
      }

      const year =
        form.year === ''
          ? null
          : Number(form.year)

      if (
        year !== null &&
        (!Number.isInteger(year) ||
          year < 1900 ||
          year > 2100)
      ) {
        throw new Error(
          'Please select a valid resource year.',
        )
      }

      let fileDetails:
        | {
            filePath: string
            fileName: string
            fileSize: number
            mimeType: string
          }
        | null = null

      if (file) {
        fileDetails = await uploadFile(file)
        newlyUploadedPath = fileDetails.filePath
      }

      const basePayload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim(),
        curriculum,
        level,
        year,
        subject,
        resource_type: form.resource_type,
        is_published: form.is_published,
      }

      if (editing) {
        const oldFilePath = editing.file_path

        const payload: Record<string, unknown> = {
          id: editing.id,
          ...basePayload,
        }

        if (fileDetails) {
          payload.file_name = fileDetails.fileName
          payload.file_path = fileDetails.filePath
          payload.file_size = fileDetails.fileSize
          payload.mime_type = fileDetails.mimeType
        }

        await callResources('PATCH', currentRole!, payload)

        if (
          fileDetails &&
          oldFilePath &&
          oldFilePath !== fileDetails.filePath
        ) {
          await removeUploadedFile(oldFilePath)
        }

        setMessage(
          'Resource updated successfully.',
        )
      } else {
        const payload: Record<string, unknown> = {
          ...basePayload,
        }

        if (fileDetails) {
          payload.file_name = fileDetails.fileName
          payload.file_path = fileDetails.filePath
          payload.file_size = fileDetails.fileSize
          payload.mime_type = fileDetails.mimeType
        }

        await callResources('POST', currentRole!, payload)

        setMessage('Resource added successfully.')
      }

      newlyUploadedPath = null
      setShowForm(false)
      setEditing(null)
      setForm(emptyForm)
      setFile(null)

      await loadResources()
    } catch (err) {
      if (newlyUploadedPath) {
        await removeUploadedFile(
          newlyUploadedPath,
        )
      }

      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save resource.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function togglePublished(
    resource: Resource,
  ) {
    if (!currentRole || !canManageResource(resource)) return

    setError('')
    setMessage('')

    try {
      await callResources('PATCH', currentRole!, {
        id: resource.id,
        is_published: !resource.is_published,
      })

      setMessage(
        resource.is_published
          ? 'Resource unpublished.'
          : 'Resource published.',
      )

      await loadResources()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to update resource.',
      )
    }
  }

  async function deleteResource(
    resource: Resource,
  ) {
    if (!currentRole || !canManageResource(resource)) return

    const confirmed = window.confirm(
      `Delete "${resource.title}" permanently?`,
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await callResources('DELETE', currentRole!, {
        id: resource.id,
      })

      setMessage(
        'Resource deleted successfully.',
      )

      await loadResources()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete resource.',
      )
    }
  }

  async function openResource(
    resource: Resource,
  ) {
    if (!resource.file_path) {
      setError(
        'This resource does not have an uploaded file.',
      )
      return
    }

    setError('')

    if (currentRole === 'student' && resource.signed_url) {
      window.open(resource.signed_url, '_blank', 'noopener,noreferrer')
      return
    }

    const { data, error: signedUrlError } =
      await supabase.storage
        .from('resources')
        .createSignedUrl(
          resource.file_path,
          60,
        )

    if (
      signedUrlError ||
      !data?.signedUrl
    ) {
      setError(
        signedUrlError?.message ||
          'Unable to open this resource.',
      )
      return
    }

    window.open(
      data.signedUrl,
      '_blank',
      'noopener,noreferrer',
    )
  }

  async function downloadResource(
    resource: Resource,
  ) {
    if (!resource.file_path) {
      setError(
        'This resource does not have an uploaded file.',
      )
      return
    }

    setError('')

    if (currentRole === 'student' && resource.signed_url) {
      const anchor = document.createElement('a')
      anchor.href = resource.signed_url
      anchor.target = '_blank'
      anchor.rel = 'noopener noreferrer'
      anchor.click()
      return
    }

    const { data, error: downloadError } =
      await supabase.storage
        .from('resources')
        .download(resource.file_path)

    if (downloadError || !data) {
      setError(
        downloadError?.message ||
          'Unable to download this resource.',
      )
      return
    }

    const url = URL.createObjectURL(data)
    const anchor =
      document.createElement('a')

    anchor.href = url
    anchor.download =
      resource.file_name || resource.title

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    URL.revokeObjectURL(url)
  }

  async function openSharePanel(resource: Resource) {
    if (currentRole !== 'platform_owner') return

    setError('')
    setMessage('')
    setSharing(true)

    try {
      const { data: teacherRows, error: teacherError } =
        await supabase
          .from('profiles')
          .select('id')
          .eq('role', 'teacher')
          .order('id')

      if (teacherError) throw teacherError

      const { data: shareRows, error: shareError } =
        await supabase
          .from('resource_shares')
          .select('teacher_id')
          .eq('resource_id', resource.id)

      if (shareError) throw shareError

      setTeachers(
        (teacherRows ?? []).map((teacher, index) => ({
          id: teacher.id,
          displayName: `Teacher ${index + 1}`,
        })),
      )
      setSharedTeacherIds(
        (shareRows ?? []).map((share) => share.teacher_id),
      )
      setSelectedTeacherId('')
      setShareResource(resource)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load sharing details.',
      )
    } finally {
      setSharing(false)
    }
  }

  function closeSharePanel() {
    if (sharing) return
    setShareResource(null)
    setTeachers([])
    setSharedTeacherIds([])
    setSelectedTeacherId('')
  }

  async function shareWithTeacher() {
    if (
      currentRole !== 'platform_owner' ||
      !shareResource ||
      !selectedTeacherId ||
      !currentUserId
    ) return

    setSharing(true)
    setError('')
    setMessage('')

    try {
      const { error: shareError } = await supabase
        .from('resource_shares')
        .insert({
          resource_id: shareResource.id,
          teacher_id: selectedTeacherId,
          shared_by: currentUserId,
        })

      if (shareError) throw shareError

      setSharedTeacherIds((current) => [...current, selectedTeacherId])
      setSelectedTeacherId('')
      setMessage('Resource shared for review successfully.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to share this resource.',
      )
    } finally {
      setSharing(false)
    }
  }

  async function revokeTeacherAccess(teacherId: string) {
    if (currentRole !== 'platform_owner' || !shareResource) return

    setSharing(true)
    setError('')
    setMessage('')

    try {
      const { error: revokeError } = await supabase
        .from('resource_shares')
        .delete()
        .eq('resource_id', shareResource.id)
        .eq('teacher_id', teacherId)

      if (revokeError) throw revokeError

      setSharedTeacherIds((current) =>
        current.filter((id) => id !== teacherId),
      )
      setMessage('Teacher access revoked.')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to revoke access.',
      )
    } finally {
      setSharing(false)
    }
  }

  const availableTeachers = teachers.filter(
    (teacher) => !sharedTeacherIds.includes(teacher.id),
  )

  const filteredResources = useMemo(() => {
    const term =
      search.trim().toLowerCase()

    if (!term) return resources

    return resources.filter((resource) => {
      return [
        resource.title,
        resource.description,
        resource.curriculum,
        resource.level,
        resource.year,
        resource.subject,
        resource.resource_type,
        resource.file_name,
      ]
        .filter(
          (value) =>
            value !== null &&
            value !== undefined,
        )
        .some((value) =>
          String(value)
            .toLowerCase()
            .includes(term),
        )
    })
  }, [resources, search])

  const resourceGroups = useMemo(() => {
    const groups = new Map<string, Map<string, Map<string, Resource[]>>>()
    for (const resource of filteredResources) {
      const classKey = `${resource.curriculum} · ${resource.level}`
      const subjectMap = groups.get(classKey) ?? new Map<string, Map<string, Resource[]>>()
      const yearMap = subjectMap.get(resource.subject) ?? new Map<string, Resource[]>()
      const yearKey = resource.year === null ? 'Year not identified' : String(resource.year)
      yearMap.set(yearKey, [...(yearMap.get(yearKey) ?? []), resource])
      subjectMap.set(resource.subject, yearMap); groups.set(classKey, subjectMap)
    }
    return groups
  }, [filteredResources])

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            {currentRole === 'platform_owner' ? 'PLATFORM ADMINISTRATION' : currentRole === 'student' ? 'STUDENT WORKSPACE' : 'TEACHER WORKSPACE'}
          </p>
          <h1>Resource Centre</h1>
        </div>

        <button
          className="avatar"
          type="button"
        >
          CN
        </button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">
            LEARNING RESOURCES
          </p>
          <h2>
            {currentRole === 'platform_owner' ? 'Manage teaching resources.' : currentRole === 'student' ? 'Your learning resources.' : 'Teaching resources.'}
          </h2>
          <p className="muted">
            {currentRole === 'platform_owner' ? 'Upload, organise, publish and manage learning materials across OLP Homework Hub.' : currentRole === 'student' ? 'Browse resources assigned to your classes, organised by class, subject and year.' : 'Manage your teaching resources and access materials shared with you.'}
          </p>
        </div>

        {currentRole !== 'student' && (
          <button className="primary" type="button" onClick={openAddForm}>
            <Plus size={17} /> Add resource
          </button>
        )}
      </section>

      {message && (
        <div className="resource-message">
          {message}
        </div>
      )}

      {error && (
        <div className="resource-error">
          {error}
        </div>
      )}

      {showForm && (
        <section className="panel resource-form-panel">
          <div className="panel-heading">
            <div>
              <h3>
                {editing
                  ? 'Edit resource'
                  : 'Add resource'}
              </h3>
              <p>
                {editing
                  ? 'Update the classification, details or file.'
                  : 'Classify and upload a learning resource.'}
              </p>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={closeForm}
              disabled={saving}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          <form
            className="resource-form"
            onSubmit={handleSave}
          >
            <label>
              <span>Title *</span>
              <input
                value={form.title}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title:
                      event.target.value,
                  })
                }
                placeholder={files.length > 0 && !editing ? "Titles will be created from filenames" : "Resource title"}
                required={editing || files.length === 0}
                disabled={!editing && files.length > 0}
              />
            </label>

            <label>
              <span>Curriculum *</span>
              <select
                value={form.curriculum}
                onChange={(event) =>
                  handleCurriculumChange(
                    event.target.value,
                  )
                }
                required
              >
                <option value="">
                  Select curriculum
                </option>

                {curriculumOptions.map(
                  (option) => (
                    <option
                      key={option.name}
                      value={option.name}
                    >
                      {option.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            {form.curriculum === 'Other' && (
              <label>
                <span>
                  Custom curriculum *
                </span>
                <input
                  value={
                    form.customCurriculum
                  }
                  onChange={(event) =>
                    setForm({
                      ...form,
                      customCurriculum:
                        event.target.value,
                    })
                  }
                  placeholder="Enter curriculum"
                  required
                />
              </label>
            )}

            <label>
              <span>Class / Level *</span>
              <select
                value={form.level}
                onChange={(event) =>
                  handleLevelChange(
                    event.target.value,
                  )
                }
                disabled={!form.curriculum}
                required
              >
                <option value="">
                  Select class / level
                </option>

                {levelOptions.map(
                  (level) => (
                    <option
                      key={level}
                      value={level}
                    >
                      {level}
                    </option>
                  ),
                )}

                {form.curriculum !==
                  'Other' &&
                  !levelOptions.includes(
                    'Other',
                  ) && (
                    <option value="Other">
                      Other
                    </option>
                  )}
              </select>
            </label>

            {form.level === 'Other' && (
              <label>
                <span>
                  Custom class / level *
                </span>
                <input
                  value={form.customLevel}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      customLevel:
                        event.target.value,
                    })
                  }
                  placeholder="Enter class or level"
                  required
                />
              </label>
            )}

            <label>
              <span>Subject *</span>
              <select
                value={form.subject}
                onChange={(event) =>
                  handleSubjectChange(
                    event.target.value,
                  )
                }
                required
              >
                <option value="">
                  Select subject
                </option>

                {subjectOptions.map(
                  (subject) => (
                    <option
                      key={subject}
                      value={subject}
                    >
                      {subject}
                    </option>
                  ),
                )}
              </select>
            </label>

            {form.subject === 'Other' && (
              <label>
                <span>Custom subject *</span>
                <input
                  value={form.customSubject}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      customSubject:
                        event.target.value,
                    })
                  }
                  placeholder="Enter subject"
                  required
                />
              </label>
            )}

            <label>
              <span>Year</span>
              <select
                value={form.year}
                onChange={(event) =>
                  setForm({
                    ...form,
                    year: event.target.value,
                  })
                }
              >
                <option value="">
                  Not year-specific
                </option>

                {resourceYears.map(
                  (year) => (
                    <option
                      key={year}
                      value={String(year)}
                    >
                      {year}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>Resource type *</span>
              <select
                value={form.resource_type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    resource_type:
                      event.target.value,
                  })
                }
                required
              >
                {resourceTypeOptions.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>
                {editing
                  ? 'Replace file'
                  : 'Resource file'}
              </span>

              <input
                type="file"
                multiple={!editing}
                onChange={(event) => {
                  const selected = Array.from(event.target.files ?? [])
                  if (editing) setFile(selected[0] ?? null)
                  else setFiles(selected)
                }}
              />
              {!editing && files.length > 0 && (
                <small>{files.length} file{files.length === 1 ? '' : 's'} selected. OLP detects a single 4-digit exam year in each filename and groups it automatically.</small>
              )}

              {editing?.file_name &&
                !file && (
                  <small>
                    Current file:{' '}
                    {editing.file_name}
                  </small>
                )}
            </label>

            <label className="resource-description">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(event) =>
                  setForm({
                    ...form,
                    description:
                      event.target.value,
                  })
                }
                placeholder="Describe this resource"
                rows={4}
              />
            </label>

            <label className="resource-checkbox">
              <input
                type="checkbox"
                checked={
                  form.is_published
                }
                onChange={(event) =>
                  setForm({
                    ...form,
                    is_published:
                      event.target.checked,
                  })
                }
              />
              <span>
                Publish this resource
              </span>
            </label>

            <div className="resource-form-actions">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="primary"
                type="submit"
                disabled={saving}
              >
                <Upload size={16} />
                {saving
                  ? 'Saving...'
                  : editing
                    ? 'Save changes'
                    : 'Add resource'}
              </button>
            </div>
          </form>
        </section>
      )}

      {currentRole === 'platform_owner' && shareResource && (
        <section className="panel resource-form-panel">
          <div className="panel-heading">
            <div>
              <h3>Share / Send for Review</h3>
              <p>
                Give a specific Teacher view and download access to
                &quot;{shareResource.title}&quot;.
              </p>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={closeSharePanel}
              disabled={sharing}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          <div className="resource-form">
            <label>
              <span>Select Teacher</span>
              <select
                value={selectedTeacherId}
                onChange={(event) =>
                  setSelectedTeacherId(event.target.value)
                }
                disabled={sharing || availableTeachers.length === 0}
              >
                <option value="">
                  {availableTeachers.length === 0
                    ? 'No additional Teachers available'
                    : 'Select Teacher'}
                </option>
                {availableTeachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.displayName}
                  </option>
                ))}
              </select>
            </label>

            <div className="resource-form-actions">
              <button
                className="primary"
                type="button"
                onClick={shareWithTeacher}
                disabled={sharing || !selectedTeacherId}
              >
                <Share2 size={16} />
                {sharing ? 'Sharing...' : 'Send for review'}
              </button>
            </div>

            <div>
              <strong>Teachers with access</strong>
              {sharedTeacherIds.length === 0 ? (
                <p className="muted">
                  This resource is private. No Teacher currently has access.
                </p>
              ) : (
                <div className="resource-list">
                  {sharedTeacherIds.map((teacherId) => {
                    const teacher = teachers.find(
                      (item) => item.id === teacherId,
                    )
                    return (
                      <div className="resource-item" key={teacherId}>
                        <div className="resource-item-content">
                          <strong>{teacher?.displayName ?? 'Teacher'}</strong>
                          <small>View and download access</small>
                        </div>
                        <div className="resource-actions">
                          <button
                            type="button"
                            onClick={() => revokeTeacherAccess(teacherId)}
                            disabled={sharing}
                          >
                            Revoke access
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Resources</h3>
              <p>
                {loading
                  ? 'Loading resources...'
                  : `${filteredResources.length} resource${
                      filteredResources.length ===
                      1
                        ? ''
                        : 's'
                    }`}
              </p>
            </div>

            <div className="resource-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search title, class, subject or year"
              />
            </div>
          </div>

          {!loading &&
            filteredResources.length ===
              0 && (
              <div className="empty-state">
                <FolderOpen size={32} />
                <strong>
                  {search
                    ? 'No matching resources'
                    : 'No resources yet'}
                </strong>
                <p>
                  {search
                    ? 'Try a different search.'
                    : 'Add your first teaching resource to get started.'}
                </p>
              </div>
            )}

          {!loading &&
            filteredResources.length >
              0 && (
              <div className="academic-library">
                {Array.from(resourceGroups.entries()).map(([className, subjectMap]) => (
                  <section className="academic-class" key={className}>
                    <div className="academic-class-heading"><FolderOpen size={20} /><div><strong>{className}</strong><small>{Array.from(subjectMap.values()).reduce((n, years) => n + Array.from(years.values()).reduce((m, items) => m + items.length, 0), 0)} resources</small></div></div>
                    {Array.from(subjectMap.entries()).map(([subject, yearMap]) => (
                      <div className="academic-subject" key={subject}>
                        <h4>{subject}</h4>
                        {Array.from(yearMap.entries()).sort(([a],[b]) => b.localeCompare(a)).map(([year, yearResources]) => (
                          <details className="academic-year" key={year} open>
                            <summary><span>{year}</span><small>{yearResources.length} item{yearResources.length === 1 ? '' : 's'}</small></summary>
                            <div className="resource-list">
                              {yearResources.map((resource) => (
<article
                      className="resource-item"
                      key={resource.id}
                    >
                      <div className="resource-item-icon">
                        <FileText
                          size={20}
                        />
                      </div>

                      <div className="resource-item-content">
                        <div className="resource-item-title">
                          <strong>
                            {resource.title}
                          </strong>

                          <span
                            className={
                              resource.is_published
                                ? 'resource-status published'
                                : 'resource-status draft'
                            }
                          >
                            {resource.is_published
                              ? 'Published'
                              : 'Draft'}
                          </span>
                        </div>

                        <p>
                          {
                            resource.curriculum
                          }
                          {' · '}
                          {resource.level}
                          {' · '}
                          {resource.subject}
                          {resource.year !==
                            null &&
                            ` · ${resource.year}`}
                        </p>

                        {resource.description && (
                          <small>
                            {
                              resource.description
                            }
                          </small>
                        )}

                        {resource.file_name && (
                          <small>
                            File:{' '}
                            {
                              resource.file_name
                            }
                          </small>
                        )}
                      </div>

                      <div className="resource-actions">
                        {resource.file_path && (
                          <>
                            <button
                              type="button"
                              title="View"
                              onClick={() =>
                                openResource(
                                  resource,
                                )
                              }
                            >
                              <Eye
                                size={16}
                              />
                            </button>

                            <button
                              type="button"
                              title="Download"
                              onClick={() =>
                                downloadResource(
                                  resource,
                                )
                              }
                            >
                              <Download
                                size={16}
                              />
                            </button>
                          </>
                        )}

                        {currentRole === 'platform_owner' &&
                          resource.created_by === currentUserId && (
                            <button
                              type="button"
                              title="Share / Send for Review"
                              onClick={() => openSharePanel(resource)}
                            >
                              <Share2 size={16} />
                            </button>
                          )}

                        {canManageResource(resource) && (
                          <>
                            <button
                              type="button"
                              title="Edit"
                              onClick={() =>
                                openEditForm(
                                  resource,
                                )
                              }
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                togglePublished(
                                  resource,
                                )
                              }
                            >
                              {resource.is_published
                                ? 'Unpublish'
                                : 'Publish'}
                            </button>

                            <button
                              type="button"
                              title="Delete"
                              onClick={() =>
                                deleteResource(
                                  resource,
                                )
                              }
                            >
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </article>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
        </div>

        {currentRole !== 'student' && <div className="panel quick">
          <h3>Resource Centre</h3>

          <button
            type="button"
            onClick={openAddForm}
          >
            <Plus size={16} />
            <span>
              <strong>
                Add a resource
              </strong>
              <small>
                Upload teaching materials
              </small>
            </span>
          </button>

          <div className="resource-summary">
            <BookOpen size={18} />
            <div>
              <strong>
                {resources.length}
              </strong>
              <small>
                Total resources
              </small>
            </div>
          </div>

          <div className="resource-summary">
            <FileText size={18} />
            <div>
              <strong>
                {
                  resources.filter(
                    (resource) =>
                      resource.is_published,
                  ).length
                }
              </strong>
              <small>Published</small>
            </div>
          </div>
        </div>}
      </section>
    </main>
  )
}