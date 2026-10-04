import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader.startsWith('Bearer ')) throw new Error('Authentication required.')

    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const admin = createClient(url, serviceKey)

    const body = await req.json().catch(() => ({}))
    const questionId = typeof body.question_id === 'string' ? body.question_id : ''
    if (!questionId) throw new Error('question_id is required.')

    // RLS is the authorization boundary: callers can request only a question they may read.
    const { data: question, error: questionError } = await userClient
      .from('exam_questions')
      .select('id,exam_id,settings')
      .eq('id', questionId)
      .single()
    if (questionError || !question) throw new Error('Question is not available to this user.')

    const { data: authData, error: authError } = await userClient.auth.getUser()
    if (authError || !authData.user) throw new Error('Authentication required.')

    const { data: exam, error: examError } = await userClient
      .from('exams')
      .select('id,created_by')
      .eq('id', question.exam_id)
      .single()
    if (examError || !exam) throw new Error('Exam is not available to this user.')

    const { data: ownerFlag } = await userClient.rpc('is_platform_owner')
    const isManager = exam.created_by === authData.user.id || ownerFlag === true
    if (!isManager) {
      const { data: attempt, error: attemptError } = await userClient
        .from('exam_attempts')
        .select('id,status,deadline_at')
        .eq('exam_id', question.exam_id)
        .eq('student_id', authData.user.id)
        .eq('status', 'in_progress')
        .maybeSingle()
      if (attemptError || !attempt) throw new Error('An active exam attempt is required for this visual.')
      if (attempt.deadline_at && Date.now() > new Date(attempt.deadline_at).getTime()) {
        throw new Error('The exam time has ended.')
      }
    }

    const settings = (question.settings ?? {}) as Record<string, unknown>
    const diagramPath = typeof settings.diagram_path === 'string' ? settings.diagram_path : ''
    const sourcePath = typeof settings.source_storage_path === 'string' ? settings.source_storage_path : ''
    const sourcePage = Number(settings.source_page ?? 1)
    const path = diagramPath || sourcePath
    if (!path) {
      return new Response(JSON.stringify({ available: false }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await admin.storage.from('exam-imports').createSignedUrl(path, 600)
    if (error || !data?.signedUrl) throw new Error('Visual could not be signed.')

    return new Response(JSON.stringify({ available: true, url: data.signedUrl, expires_in: 600, kind: diagramPath ? 'image' : 'source_pdf', source_page: sourcePage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Visual request failed.' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
