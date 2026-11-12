import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type SignupRole = 'teacher' | 'student'

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
  if (previous?.status === 'sent') return 'already_sent'

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
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      { error: 'Method not allowed.' },
      405,
    )
  }

  try {
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL')

    const anonKey =
      Deno.env.get('SUPABASE_ANON_KEY')

    const serviceRoleKey =
      Deno.env.get(
        'SUPABASE_SERVICE_ROLE_KEY',
      )

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      return jsonResponse(
        {
          error:
            'Server configuration is incomplete.',
        },
        500,
      )
    }

    const body = await req.json()

    const fullName =
      typeof body.full_name === 'string'
        ? body.full_name.trim()
        : ''

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''

    const password =
      typeof body.password === 'string'
        ? body.password
        : ''

    const role =
      body.role as SignupRole

    if (!fullName) {
      return jsonResponse(
        {
          error:
            'Full name is required.',
        },
        400,
      )
    }

    if (!email) {
      return jsonResponse(
        {
          error:
            'Email address is required.',
        },
        400,
      )
    }

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
     * Only these two public roles are permitted.
     * Platform Owner can never be created here.
     */
    if (
      role !== 'teacher' &&
      role !== 'student'
    ) {
      return jsonResponse(
        {
          error:
            'Account type must be Teacher or Student.',
        },
        400,
      )
    }

    /*
     * Use normal Supabase signup rather than
     * Admin createUser so the project's normal
     * email-confirmation rules still apply.
     */
    const signupClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      )

    const {
      data,
      error: signupError,
    } =
      await signupClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,

            /*
             * This is supplied for the Auth
             * user metadata, but the server has
             * already restricted it above.
             */
            role,
          },
        },
      })

    if (signupError) {
      return jsonResponse(
        {
          error:
            signupError.message,
        },
        400,
      )
    }

    if (!data.user) {
      return jsonResponse(
        {
          error:
            'Unable to create account.',
        },
        400,
      )
    }

    /*
     * Ensure public.profiles is aligned even
     * if the existing signup trigger already
     * created the profile.
     */
    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        },
      )

    const {
      error: profileError,
    } = await admin
      .from('profiles')
      .upsert(
        {
          id: data.user.id,
          full_name: fullName,
          role,
        },
        {
          onConflict: 'id',
        },
      )

    if (profileError) {
      /*
       * Avoid leaving a partially created
       * account with no usable OLP profile.
       */
      await admin.auth.admin.deleteUser(
        data.user.id,
      )

      return jsonResponse(
        {
          error:
            'Account profile could not be created.',
        },
        500,
      )
    }

    if (role === 'teacher') {
      try {
        await sendTeacherWelcomeEmail(admin, data.user.id, email, fullName)
      } catch (emailError) {
        // Account creation must succeed even when email delivery is temporarily unavailable.
        console.error('Teacher welcome email failed:', emailError)
      }
    }

    /*
     * A session usually means email confirmation
     * is not required. No session usually means
     * Supabase is waiting for email confirmation.
     */
    const confirmationRequired =
      !data.session

    return jsonResponse(
      {
        message:
          confirmationRequired
            ? 'Account created. Please confirm your email, then sign in.'
            : 'Account created successfully. You can now sign in.',

        confirmation_required:
          confirmationRequired,

        role,
      },
      201,
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