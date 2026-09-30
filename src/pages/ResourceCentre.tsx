from pathlib import Path

p = Path("/mnt/data/Pasted text(1).txt")
src = p.read_text(encoding="utf-8")

src = src.replace("type ResourceForm = {", "type UserRole = 'platform_owner' | 'teacher'\n\ntype ResourceForm = {", 1)

src = src.replace(
"""  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadResources()
  }, [])""",
"""  const [saving, setSaving] = useState(false)
  const [currentUserId, setCurrentUserId] = useState('')
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null)

  useEffect(() => {
    initialiseResourceCentre()
  }, [])""",
1,
)

a = src.index("  async function callOwnerResources(")
b = src.index("  function openAddForm()", a)
src = src[:a] + """  async function getCurrentIdentity() {
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

""" + src[b:]

src = src.replace("await callOwnerResources('PATCH', payload)", "await callResources('PATCH', currentRole!, payload)")
src = src.replace("await callOwnerResources('POST', payload)", "await callResources('POST', currentRole!, payload)")
src = src.replace("await callOwnerResources('PATCH', {", "await callResources('PATCH', currentRole!, {")
src = src.replace("await callOwnerResources('DELETE', {", "await callResources('DELETE', currentRole!, {")

needle = """    try {
      const curriculum = actualCurriculum()"""
src = src.replace(needle, """    try {
      if (!currentRole) {
        throw new Error('Your Resource Centre session is not ready.')
      }

      const curriculum = actualCurriculum()""", 1)

src = src.replace(
"""  async function togglePublished(
    resource: Resource,
  ) {
    setError('')""",
"""  async function togglePublished(
    resource: Resource,
  ) {
    if (!currentRole || !canManageResource(resource)) return

    setError('')""",
1,
)
src = src.replace(
"""  async function deleteResource(
    resource: Resource,
  ) {
    const confirmed""",
"""  async function deleteResource(
    resource: Resource,
  ) {
    if (!currentRole || !canManageResource(resource)) return

    const confirmed""",
1,
)

src = src.replace(
"""          <p className="eyebrow">
            PLATFORM ADMINISTRATION
          </p>""",
"""          <p className="eyebrow">
            {currentRole === 'platform_owner'
              ? 'PLATFORM ADMINISTRATION'
              : 'TEACHER WORKSPACE'}
          </p>""",
1,
)
src = src.replace(
"""          <h2>
            Manage teaching resources.
          </h2>
          <p className="muted">
            Upload, organise, publish and
            manage learning materials across
            OLP Homework Hub.
          </p>""",
"""          <h2>
            {currentRole === 'platform_owner'
              ? 'Manage teaching resources.'
              : 'Teaching resources.'}
          </h2>
          <p className="muted">
            {currentRole === 'platform_owner'
              ? 'Upload, organise, publish and manage learning materials across OLP Homework Hub.'
              : 'Browse published learning materials and manage the resources you upload.'}
          </p>""",
1,
)

old = """                        <button
                          type="button"
                          title="Edit"
                          onClick={() =>
                            openEditForm(
                              resource,
                            )
                          }
                        >
                          <Edit3
                            size={16}
                          />
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
                          <Trash2
                            size={16}
                          />
                        </button>"""
new = """                        {canManageResource(resource) && (
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
                        )}"""
if old not in src:
    raise RuntimeError("Could not locate management controls")
src = src.replace(old, new, 1)

out = Path("/mnt/data/ResourceCentre-role-aware.tsx")
out.write_text(src, encoding="utf-8")
print(f"Created {out.name} ({len(src.splitlines())} lines)")
