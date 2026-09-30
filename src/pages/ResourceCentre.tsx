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
}

type UserRole = 'platform_owner' | 'teacher'

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
  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)

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
      profile.role !== 'teacher'
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
    const functionName =
      role === 'platform_owner'
        ? 'owner-resources'
        : 'teacher-resources'

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

  async function initialiseResourceCentre() {
    setLoading(true)
    setError('')

    try {
      const identity = await getCurrentIdentity()
      setCurrentUserId(identity.userId)
      setCurrentRole(identity.role)

      const result = await callResources('GET', identity.role)
      setResources(result.resources ?? [])
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
      const result = await callResources('GET', currentRole)
      setResources(result.resources ?? [])
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
        !form.title.trim() ||
        !curriculum ||
        !level ||
        !subject
      ) {
        throw new Error(
          'Title, curriculum, class/level and subject are required.',
        )
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

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            {currentRole === 'platform_owner'
              ? 'PLATFORM ADMINISTRATION'
              : 'TEACHER WORKSPACE'}
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
            {currentRole === 'platform_owner'
              ? 'Manage teaching resources.'
              : 'Teaching resources.'}
          </h2>
          <p className="muted">
            {currentRole === 'platform_owner'
              ? 'Upload, organise, publish and manage learning materials across OLP Homework Hub.'
              : 'Browse published learning materials and manage the resources you upload.'}
          </p>
        </div>

        <button
          className="primary"
          type="button"
          onClick={openAddForm}
        >
          <Plus size={17} />
          Add resource
        </button>
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
                placeholder="Resource title"
                required
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
                onChange={(event) =>
                  setFile(
                    event.target.files?.[0] ??
                      null,
                  )
                }
              />

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
              <div className="resource-list">
                {filteredResources.map(
                  (resource) => (
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
                  ),
                )}
              </div>
            )}
        </div>

        <div className="panel quick">
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
        </div>
      </section>
    </main>
  )
}