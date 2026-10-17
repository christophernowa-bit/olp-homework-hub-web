import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' }
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') return reply({ error: 'POST required' }, 405)
  try {
    const token = req.headers.get('Authorization') || ''
    if (!token.startsWith('Bearer ')) return reply({ error: 'Authentication required' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: token } } })
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: auth, error: authError } = await userClient.auth.getUser()
    if (authError || !auth.user) return reply({ error: 'Authentication required' }, 401)
    const { submission_id } = await req.json()
    if (typeof submission_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(submission_id)) return reply({ error: 'Valid submission_id required' }, 400)
    const { data: submission, error: submissionError } = await admin.from('assignment_submissions')
      .select('id,assignment_id,status,text_response,response_json').eq('id', submission_id).single()
    if (submissionError || !submission) return reply({ error: 'Submission not found' }, 404)
    if (!['submitted', 'marked'].includes(submission.status)) return reply({ error: 'Submission cannot be AI marked in its current state' }, 409)
    const { data: assignment } = await admin.from('assignments')
      .select('id,title,created_by,total_marks,content_json,instructions').eq('id', submission.assignment_id).single()
    if (!assignment) return reply({ error: 'Assignment not found' }, 404)
    const { data: owner } = await admin.rpc('is_platform_owner', { p_user_id: auth.user.id })
    if (assignment.created_by !== auth.user.id && owner !== true) return reply({ error: 'Only the assignment teacher or owner can mark' }, 403)
    const { data: keyRow } = await admin.from('assignment_ai_keys').select('marking_key_text').eq('assignment_id', assignment.id).single()
    if (!keyRow?.marking_key_text?.trim()) return reply({ error: 'Save the marking key before AI marking' }, 409)
    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return reply({ error: 'AI service is not configured' }, 503)
    const prompt = [
      'You are an educational marking assistant. Use ONLY the teacher marking key as the authority.',
      'Award partial credit when explicitly supported by the marking key. Never exceed the assignment total.',
      'If answers or marking rules are ambiguous, flag teacher review. Teacher approval is mandatory.',
      'Return JSON ONLY: {"mark":number,"feedback":string,"needs_teacher_review":boolean}.',
      'Assignment: ' + assignment.title,
      'Total marks: ' + assignment.total_marks,
      'Assignment questions: ' + JSON.stringify(assignment.content_json),
      'Teacher marking key: ' + keyRow.marking_key_text,
      'Student response: ' + JSON.stringify({ text: submission.text_response, document: submission.response_json }),
    ].join('\n\n')
    const model = 'gemini-2.5-flash'
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0, responseMimeType: 'application/json' } }),
    })
    if (!response.ok) return reply({ error: 'AI service temporarily unavailable; no marks were returned' }, 502)
    const payload = await response.json()
    const output = payload?.candidates?.[0]?.content?.parts?.map((p: {text?:string}) => p.text || '').join('') || ''
    let result: { mark?: unknown; feedback?: unknown; needs_teacher_review?: unknown }
    try { result = JSON.parse(output) } catch { return reply({ error: 'AI returned invalid data; no marks were saved' }, 502) }
    const mark = Number(result.mark)
    if (!Number.isFinite(mark) || mark < 0 || mark > Number(assignment.total_marks)) return reply({ error: 'AI proposed an invalid mark; teacher review required' }, 422)
    // Do not update the student's submission: teacher must explicitly approve the proposed mark.
    return reply({ ok: true, ai_mark: mark, feedback: typeof result.feedback === 'string' ? result.feedback : '', needs_teacher_review: true, model })
  } catch (error) {
    console.error('assignment-ai-mark', error)
    return reply({ error: 'Assignment AI marking failed safely' }, 500)
  }
})
