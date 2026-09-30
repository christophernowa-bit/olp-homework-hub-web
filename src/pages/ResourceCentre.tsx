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

type Resource = {
  id: string
  title: string
  description: string | null
  curriculum: string
  level: string
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

type ResourceForm = {
  title: string
  description: string
  curriculum: string
  level: string
  subject: string
  resource_type: string
  is_published: boolean
}

const emptyForm: ResourceForm = {
  title: '',
  description: '',
  curriculum: '',
  level: '',
  subject: '',
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

  useEffect(() => {
    loadResources()
  }, [])

  async function getAccessToken() {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      throw sessionError
    }

    if (!session?.access_token) {
      throw new Error('Your session has expired. Please sign in again.')
    }

    return session.access_token
  }

  async function callOwnerResources(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    body?: Record<string, unknown>,
  ) {
    const token = await getAccessToken()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/owner-resources`,
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

  async function loadResources() {
    setLoading(true)
    setError('')

    try {
      const result = await callOwnerResources('GET')
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

  function openAddForm() {
    setEditing(null)
    setForm(emptyForm)
    setFile(null)
    setMessage('')
    setError('')
    setShowForm(true)
  }

  function openEditForm(resource: Resource) {
    setEditing(resource)
    setForm({
      title: resource.title,
      description: resource.description ?? '',
      curriculum: resource.curriculum,
      level: resource.level,
      subject: resource.subject,
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

  async function uploadFile(selectedFile: File) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new Error('Unable to verify the signed-in user.')
    }

    const safeName = selectedFile.name
      .replace(/[^a-zA-Z0-9._-]/g, '_')

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}-${safeName}`

    const filePath = `${user.id}/${uniqueName}`

    const { error: uploadError } = await supabase.storage
      .from('resources')
      .upload(filePath, selectedFile, {
        cacheControl: '3600',
        upsert: false,
        contentType:
          selectedFile.type || 'application/octet-stream',
      })

    if (uploadError) {
      throw uploadError
    }

    return {
      filePath,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      mimeType:
        selectedFile.type || 'application/octet-stream',
    }
  }

  async function removeUploadedFile(filePath: string) {
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
      if (
        !form.title.trim() ||
        !form.curriculum.trim() ||
        !form.level.trim() ||
        !form.subject.trim()
      ) {
        throw new Error(
          'Title, curriculum, level and subject are required.',
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

      if (editing) {
        const oldFilePath = editing.file_path

        const payload: Record<string, unknown> = {
          id: editing.id,
          title: form.title.trim(),
          description: form.description.trim(),
          curriculum: form.curriculum.trim(),
          level: form.level.trim(),
          subject: form.subject.trim(),
          resource_type: form.resource_type,
          is_published: form.is_published,
        }

        if (fileDetails) {
          payload.file_name = fileDetails.fileName
          payload.file_path = fileDetails.filePath
          payload.file_size = fileDetails.fileSize
          payload.mime_type = fileDetails.mimeType
        }

        await callOwnerResources('PATCH', payload)

        if (
          fileDetails &&
          oldFilePath &&
          oldFilePath !== fileDetails.filePath
        ) {
          await removeUploadedFile(oldFilePath)
        }

        setMessage('Resource updated successfully.')
      } else {
        const payload: Record<string, unknown> = {
          title: form.title.trim(),
          description: form.description.trim(),
          curriculum: form.curriculum.trim(),
          level: form.level.trim(),
          subject: form.subject.trim(),
          resource_type: form.resource_type,
          is_published: form.is_published,
        }

        if (fileDetails) {
          payload.file_name = fileDetails.fileName
          payload.file_path = fileDetails.filePath
          payload.file_size = fileDetails.fileSize
          payload.mime_type = fileDetails.mimeType
        }

        await callOwnerResources('POST', payload)

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
        await removeUploadedFile(newlyUploadedPath)
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

  async function togglePublished(resource: Resource) {
    setError('')
    setMessage('')

    try {
      await callOwnerResources('PATCH', {
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

  async function deleteResource(resource: Resource) {
    const confirmed = window.confirm(
      `Delete "${resource.title}" permanently?`,
    )

    if (!confirmed) return

    setError('')
    setMessage('')

    try {
      await callOwnerResources('DELETE', {
        id: resource.id,
      })

      setMessage('Resource deleted successfully.')
      await loadResources()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to delete resource.',
      )
    }
  }

  async function openResource(resource: Resource) {
    if (!resource.file_path) {
      setError('This resource does not have an uploaded file.')
      return
    }

    setError('')

    const { data, error: signedUrlError } =
      await supabase.storage
        .from('resources')
        .createSignedUrl(resource.file_path, 60)

    if (signedUrlError || !data?.signedUrl) {
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

  async function downloadResource(resource: Resource) {
    if (!resource.file_path) {
      setError('This resource does not have an uploaded file.')
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
    const anchor = document.createElement('a')

    anchor.href = url
    anchor.download = resource.file_name || resource.title

    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()

    URL.revokeObjectURL(url)
  }

  const filteredResources = useMemo(() => {
    const term = search.trim().toLowerCase()

    if (!term) return resources

    return resources.filter((resource) => {
      return [
        resource.title,
        resource.description,
        resource.curriculum,
        resource.level,
        resource.subject,
        resource.resource_type,
        resource.file_name,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(term),
        )
    })
  }, [resources, search])

  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">PLATFORM ADMINISTRATION</p>
          <h1>Resource Centre</h1>
        </div>

        <button className="avatar" type="button">
          CN
        </button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">LEARNING RESOURCES</p>
          <h2>Manage teaching resources.</h2>
          <p className="muted">
            Upload, organise, publish and manage learning
            materials across OLP Homework Hub.
          </p>
        </div>

        <button
          className="primary"
          type="button"
          onClick={openAddForm}
        >
          <Plus size={18} />
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
                {editing ? 'Edit resource' : 'Add resource'}
              </h3>
              <p>
                {editing
                  ? 'Update the resource details or replace its file.'
                  : 'Add a new learning resource to OLP Homework Hub.'}
              </p>
            </div>

            <button
              className="icon-button"
              type="button"
              onClick={closeForm}
              disabled={saving}
            >
              <X size={20} />
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
                    title: event.target.value,
                  })
                }
                placeholder="Resource title"
                required
              />
            </label>

            <label>
              <span>Curriculum *</span>
              <input
                value={form.curriculum}
                onChange={(event) =>
                  setForm({
                    ...form,
                    curriculum: event.target.value,
                  })
                }
                placeholder="e.g. Cambridge Primary"
                required
              />
            </label>

            <label>
              <span>Level *</span>
              <input
                value={form.level}
                onChange={(event) =>
                  setForm({
                    ...form,
                    level: event.target.value,
                  })
                }
                placeholder="e.g. Stage 6"
                required
              />
            </label>

            <label>
              <span>Subject *</span>
              <input
                value={form.subject}
                onChange={(event) =>
                  setForm({
                    ...form,
                    subject: event.target.value,
                  })
                }
                placeholder="e.g. Science"
                required
              />
            </label>

            <label>
              <span>Resource type</span>
              <select
                value={form.resource_type}
                onChange={(event) =>
                  setForm({
                    ...form,
                    resource_type: event.target.value,
                  })
                }
              >
                <option value="document">Document</option>
                <option value="worksheet">Worksheet</option>
                <option value="past_paper">Past paper</option>
                <option value="mark_scheme">Mark scheme</option>
                <option value="lesson_note">Lesson note</option>
                <option value="presentation">Presentation</option>
                <option value="image">Image</option>
                <option value="other">Other</option>
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
                  setFile(event.target.files?.[0] ?? null)
                }
              />

              {editing?.file_name && !file && (
                <small>
                  Current file: {editing.file_name}
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
                    description: event.target.value,
                  })
                }
                placeholder="Describe this resource"
                rows={4}
              />
            </label>

            <label className="resource-checkbox">
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(event) =>
                  setForm({
                    ...form,
                    is_published: event.target.checked,
                  })
                }
              />
              <span>Publish this resource</span>
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
                <Upload size={17} />
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
                      filteredResources.length === 1
                        ? ''
                        : 's'
                    }`}
              </p>
            </div>

            <div className="resource-search">
              <Search size={18} />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search resources"
              />
            </div>
          </div>

          {!loading && filteredResources.length === 0 && (
            <div className="empty-state">
              <FolderOpen size={34} />
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

          {!loading && filteredResources.length > 0 && (
            <div className="resource-list">
              {filteredResources.map((resource) => (
                <article
                  className="resource-item"
                  key={resource.id}
                >
                  <div className="resource-item-icon">
                    <FileText size={22} />
                  </div>

                  <div className="resource-item-content">
                    <div className="resource-item-title">
                      <strong>{resource.title}</strong>

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
                      {resource.curriculum} · {resource.level}
                      {' · '}
                      {resource.subject}
                    </p>

                    {resource.description && (
                      <small>{resource.description}</small>
                    )}

                    {resource.file_name && (
                      <small>
                        File: {resource.file_name}
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
                            openResource(resource)
                          }
                        >
                          <Eye size={17} />
                        </button>

                        <button
                          type="button"
                          title="Download"
                          onClick={() =>
                            downloadResource(resource)
                          }
                        >
                          <Download size={17} />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      title="Edit"
                      onClick={() =>
                        openEditForm(resource)
                      }
                    >
                      <Edit3 size={17} />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        togglePublished(resource)
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
                        deleteResource(resource)
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="panel quick">
          <h3>Resource Centre</h3>

          <button
            type="button"
            onClick={openAddForm}
          >
            <Plus size={17} />
            <span>
              <strong>Add a resource</strong>
              <small>Upload teaching materials</small>
            </span>
          </button>

          <div className="resource-summary">
            <BookOpen size={20} />
            <div>
              <strong>{resources.length}</strong>
              <small>Total resources</small>
            </div>
          </div>

          <div className="resource-summary">
            <FileText size={20} />
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
