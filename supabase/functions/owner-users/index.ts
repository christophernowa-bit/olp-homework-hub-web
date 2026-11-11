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