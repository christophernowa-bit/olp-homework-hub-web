import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
}

type UserRole = 'platform_owner' | 'teacher' | 'student'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function sendTeacherWelcomeEmail(
  admin: any,
  teacherId: string,
  email: string,
  fullName: string,
  forceResend = false,
): Promise<'sent' | 'already_sent'> {
  const endpoint = Deno.env.get('APPS_SCRIPT_WEB_APP_URL')
  const sharedSecret = Deno.env.get('APPS_SCRIPT_SHARED_SECRET')
  const appUrl = Deno.env.get('OLP_APP_URL')

  if (!endpoint || !sharedSecret || !appUrl) {
    throw new Error('Google email delivery is not configured yet.')
  }

  const { data: previous, error: lookupError } = await admin
    .from('teacher_welcome_email_log')
    .select('status')
    .eq('teacher_id', teacherId)
    .maybeSingle()
  if (lookupError) throw lookupError
  if (!forceResend && previous?.status === 'sent') return 'already_sent'

  const { error: logError } = await admin
    .from('teacher_welcome_email_log')
    .upsert({
      teacher_id: teacherId,
      email,
      status: 'sending',
      last_attempt_at: new Date().toISOString(),
      last_error: null,
    }, { onConflict: 'teacher_id' })
  if (logError) throw logError

  const supportUrl = `${appUrl.replace(/\/+$/, '')}/support`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      redirect: 'follow',
      body: JSON.stringify({
        token: sharedSecret,
        to: email,
        fullName: fullName || 'Teacher',
        supportUrl,
      }),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.ok !== true) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Google could not send the welcome email.')
    }

    const { error: sentError } = await admin
      .from('teacher_welcome_email_log')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        provider_message_id: null,
        last_error: null,
      })
      .eq('teacher_id', teacherId)
    if (sentError) throw sentError
    return 'sent'
  } catch (error) {
    await admin.from('teacher_welcome_email_log').update({
      status: 'failed',
      last_error: error instanceof Error ? error.message.slice(0, 500) : 'Unknown email error.',
    }).eq('teacher_id', teacherId)
    throw error
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const authorization = req.headers.get('Authorization')

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(
        { error: 'Server configuration is incomplete.' },
        500,
      )
    }

    if (!authorization) {
      return jsonResponse({ error: 'Not authenticated.' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const token = authorization.replace(/^Bearer\s+/i, '')

    const {
      data: { user: caller },
      error: callerError,
    } = await admin.auth.getUser(token)

    if (callerError || !caller) {
      return jsonResponse({ error: 'Invalid session.' }, 401)
    }

    const { data: callerProfile, error: profileError } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (
      profileError ||
      !callerProfile ||
      callerProfile.role !== 'platform_owner'
    ) {
      return jsonResponse(
        { error: 'Platform Owner access required.' },
        403,
      )
    }

    /*
     * LIST USERS
     */
    if (req.method === 'GET') {
      const { data: profiles, error: profilesError } = await admin
        .from('profiles')
        .select('id, full_name, role, created_at')
        .order('created_at', { ascending: false })

      if (profilesError) {
        throw profilesError
      }

      const { data: authData, error: authError } =
        await admin.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        })

      if (authError) {
        throw authError
      }

      const authUserById = new Map(
        authData.users.map((user) => [user.id, user]),
      )

      const users = profiles.map((profile) => {
        const authUser = authUserById.get(profile.id)
        return {
          id: profile.id,
          email: authUser?.email ?? '',
          full_name: profile.full_name ?? '',
          role: profile.role,
          created_at: profile.created_at,
          is_suspended: Boolean(
            authUser?.banned_until &&
              new Date(authUser.banned_until).getTime() > Date.now(),
          ),
        }
      })

      return jsonResponse({ users })
    }

    /*
     * CREATE USER
     */
    if (req.method === 'POST') {
      const body = await req.json()

      if (body.action === 'resend_teacher_welcome_email') {
        const teacherId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
        if (!teacherId) return jsonResponse({ error: 'Teacher ID is required.' }, 400)

        const { data: teacherProfile, error: teacherError } = await admin
          .from('profiles')
          .select('id, full_name, role')
          .eq('id', teacherId)
          .maybeSingle()
        if (teacherError) throw teacherError
        if (!teacherProfile) return jsonResponse({ error: 'Teacher not found.' }, 404)
        if (teacherProfile.role !== 'teacher') {
          return jsonResponse({ error: 'This action is only available for teacher accounts.' }, 400)
        }

        const { data: authData, error: authError } = await admin.auth.admin.getUserById(teacherId)
        if (authError) throw authError
        const teacherEmail = authData.user?.email ?? ''
        if (!teacherEmail) return jsonResponse({ error: 'No email address is available for this teacher.' }, 400)

        await sendTeacherWelcomeEmail(admin, teacherId, teacherEmail, teacherProfile.full_name ?? '', true)
        return jsonResponse({ message: `Welcome email resent to ${teacherEmail}.` })
      }

      if (body.action === 'send_missing_teacher_welcome_emails') {
        const [{ data: profiles, error: profilesError }, { data: authData, error: authError }] = await Promise.all([
          admin.from('profiles').select('id, full_name, role').eq('role', 'teacher'),
          admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        ])
        if (profilesError) throw profilesError
        if (authError) throw authError

        let sentCount = 0
        let skippedCount = 0
        const failures: Array<{ email: string; error: string }> = []
        const authById = new Map(authData.users.map((user) => [user.id, user]))

        for (const profile of profiles ?? []) {
          if (sentCount + skippedCount > 0) {
            await new Promise((resolve) => setTimeout(resolve, 600))
          }
          const authUser = authById.get(profile.id)
          const teacherEmail = authUser?.email ?? ''
          if (!teacherEmail) {
            failures.push({ email: '(no email on account)', error: 'No email address is available.' })
            continue
          }
          try {
            const result = await sendTeacherWelcomeEmail(admin, profile.id, teacherEmail, profile.full_name ?? '')
            if (result === 'sent') sentCount += 1
            else skippedCount += 1
          } catch (error) {
            failures.push({
              email: teacherEmail,
              error: error instanceof Error ? error.message : 'Email could not be sent.',
            })
          }
        }

        return jsonResponse({
          sent_count: sentCount,
          skipped_count: skippedCount,
          failed_count: failures.length,
          failures,
        })
      }

      const email =
        typeof body.email === 'string'
          ? body.email.trim().toLowerCase()
          : ''

      const fullName =
        typeof body.full_name === 'string'
          ? body.full_name.trim()
          : ''

      const role = body.role as UserRole

      if (!email) {
        return jsonResponse({ error: 'Email is required.' }, 400)
      }

      if (!['teacher', 'student'].includes(role)) {
        return jsonResponse(
          { error: 'New users must be Teacher or Student.' },
          400,
        )
      }

      const { data, error } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: {
            full_name: fullName,
            role,
          },
        })

      if (error) {
        return jsonResponse({ error: error.message }, 400)
      }

      if (data.user) {
        const { error: upsertError } = await admin
          .from('profiles')
          .upsert(
            {
              id: data.user.id,
              full_name: fullName,
              role,
            },
            { onConflict: 'id' },
          )

        if (upsertError) {
          throw upsertError
        }

        if (role === 'teacher' && data.user.email) {
          try {
            await sendTeacherWelcomeEmail(admin, data.user.id, data.user.email, fullName)
          } catch (emailError) {
            console.error('Teacher welcome email failed:', emailError)
          }
        }
      }

      return jsonResponse(
        {
          message: 'User invitation sent.',
          user_id: data.user?.id ?? null,
        },
        201,
      )
    }

    /*
     * CHANGE ROLE OR RESET PASSWORD
     */
    if (req.method === 'PATCH') {
      const body = await req.json()

      const userId =
        typeof body.user_id === 'string'
          ? body.user_id.trim()
          : ''

      if (!userId) {
        return jsonResponse(
          { error: 'User ID is required.' },
          400,
        )
      }

      /*
       * SUSPEND OR RESTORE TEACHER ACCESS.
       * This blocks sign-in while preserving profiles and historical work.
       */
      if (
        body.action === 'deactivate_teacher' ||
        body.action === 'restore_teacher'
      ) {
        if (userId === caller.id) {
          return jsonResponse({ error: 'You cannot remove your own access.' }, 400)
        }

        const { data: targetProfile, error: targetError } = await admin
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()

        if (targetError || !targetProfile) {
          return jsonResponse({ error: 'Teacher not found.' }, 404)
        }

        if (targetProfile.role !== 'teacher') {
          return jsonResponse({ error: 'This action is only available for teacher accounts.' }, 400)
        }

        const { error: accessError } = await admin.auth.admin.updateUserById(
          userId,
          {
            ban_duration:
              body.action === 'deactivate_teacher' ? '876000h' : 'none',
          },
        )

        if (accessError) {
          return jsonResponse({ error: accessError.message }, 400)
        }

        return jsonResponse({
          message:
            body.action === 'deactivate_teacher'
              ? 'Teacher access suspended.'
              : 'Teacher access restored.',
        })
      }

      /*
       * RESET PASSWORD
       */
      if (body.action === 'reset_password') {
        const password =
          typeof body.password === 'string'
            ? body.password
            : ''

        if (password.length < 8) {
          return jsonResponse(
            {
              error:
                'Password must contain at least 8 characters.',
            },
            400,
          )
        }

        /*
         * Do not allow this screen to change the signed-in
         * Platform Owner's own password.
         */
        if (userId === caller.id) {
          return jsonResponse(
            {
              error:
                'Use your account settings to change your own password.',
            },
            400,
          )
        }

        const { data: targetProfile, error: targetError } =
          await admin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()

        if (targetError || !targetProfile) {
          return jsonResponse(
            { error: 'User not found.' },
            404,
          )
        }

        /*
         * Protect Platform Owner accounts from password changes
         * through ordinary Users & Roles administration.
         */
        if (targetProfile.role === 'platform_owner') {
          return jsonResponse(
            {
              error:
                'Platform Owner passwords cannot be reset from Users & Roles.',
            },
            400,
          )
        }

        const { error: passwordError } =
          await admin.auth.admin.updateUserById(userId, {
            password,
            email_confirm: true,
          })

        if (passwordError) {
          return jsonResponse(
            { error: passwordError.message },
            400,
          )
        }

        return jsonResponse({
          message: 'Password updated successfully.',
        })
      }

      /*
       * CHANGE ROLE
       */
      const role = body.role as UserRole

      if (!['teacher', 'student'].includes(role)) {
        return jsonResponse(
          { error: 'Role must be Teacher or Student.' },
          400,
        )
      }

      if (userId === caller.id) {
        return jsonResponse(
          {
            error:
              'You cannot change your own Platform Owner role here.',
          },
          400,
        )
      }

      const { data: targetProfile, error: targetError } =
        await admin
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single()

      if (targetError || !targetProfile) {
        return jsonResponse(
          { error: 'User not found.' },
          404,
        )
      }

      if (targetProfile.role === 'platform_owner') {
        return jsonResponse(
          {
            error:
              'Platform Owner roles cannot be changed from Users & Roles.',
          },
          400,
        )
      }

      const { error: updateError } = await admin
        .from('profiles')
        .update({ role })
        .eq('id', userId)

      if (updateError) {
        throw updateError
      }

      return jsonResponse({
        message: 'User role updated.',
      })
    }

    return jsonResponse(
      { error: 'Method not allowed.' },
      405,
    )
  } catch (error) {
    console.error(error)

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected server error.',
      },
      500,
    )
  }
})