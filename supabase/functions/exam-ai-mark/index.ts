import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})
const cleanJson=(t:string)=>t.trim().replace(/^\`\`\`json\s*/i,'').replace(/^\`\`\`\s*/i,'').replace(/\s*\`\`\`$/i,'').trim()
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms))
function toBase64(bytes:Uint8Array){let b='';for(let i=0;i<bytes.length;i+=0x8000)b+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(b)}
async function gemini(key:string,mime:string,data:string,prompt:string){
 const plan=[{model:'gemini-3.8-flash',delays:[0,2000]},{model:'gemini-3.7-flash',delays:[1000,3000]},{model:'gemini-2.5-flash',delays:[1000,3000]}]
 const attempts:any[]=[]; let last:any=null
 for(const p of plan)for(let i=0;i<p.delays.length;i++){if(p.delays[i])await sleep(p.delays[i]);try{
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+p.model+':generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':key},body:JSON.stringify({contents:[{parts:mime==='text/plain'?[{text:'AUTHORITATIVE TEACHER MARKING KEY:\n'+data},{text:prompt}]:[{inline_data:{mime_type:mime,data}},{text:prompt}]}],generationConfig:{temperature:0,responseMimeType:'application/json'}})})
  const payload=await r.json().catch(()=>null); last=payload
  attempts.push({model:p.model,status:r.status,error:r.ok?null:payload?.error?.message||('HTTP '+r.status)})
  if(r.ok)return{ok:true,model:p.model,payload,attempts}
  if(![408,429,500,502,503,504].includes(r.status))return{ok:false,model:p.model,payload,attempts}
 }catch(e){attempts.push({model:p.model,status:0,error:e instanceof Error?e.message:'Network error'})}}
 return{ok:false,model:plan[plan.length-1].model,payload:last,attempts}
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:corsHeaders})
 let admin:any=null,attemptId='',originalStatus='submitted'
 try{
  const auth=req.headers.get('Authorization')??''; if(!auth.startsWith('Bearer '))return json({error:'Authentication required.'},401)
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,key=Deno.env.get('GEMINI_API_KEY')
  if(!key)return json({error:'GEMINI_API_KEY is not configured.'},500)
  const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}}}); admin=createClient(url,service)
  const{data:authData,error:authError}=await userClient.auth.getUser();if(authError||!authData.user)return json({error:'Authentication required.'},401)
  const body=await req.json().catch(()=>({}));attemptId=typeof body.attempt_id==='string'?body.attempt_id.trim():'';if(!attemptId)return json({error:'attempt_id is required.'},400)
  const{data:attempt,error:attemptError}=await admin.from('exam_attempts').select('id,exam_id,status').eq('id',attemptId).single()
  if(attemptError||!attempt)return json({error:'Exam attempt was not found.'},404)
  originalStatus=attempt.status
  if(!['submitted','marked'].includes(attempt.status))return json({error:'This attempt is not ready for AI marking. Current status: '+attempt.status},409)
  const{data:exam,error:examError}=await admin.from('exams').select('id,title,created_by,marking_key_path,marking_key_mime_type').eq('id',attempt.exam_id).single()
  if(examError||!exam)return json({error:'Exam was not found.'},404)
  const{data:owner}=await admin.rpc('is_platform_owner',{p_user_id:authData.user.id})
  if(exam.created_by!==authData.user.id&&owner!==true)return json({error:'You cannot mark this exam.'},403)
  if(!exam.marking_key_path)return json({error:'Attach a whole-paper marking key before AI marking.'},409)
  const{data:file,error:fileError}=await admin.storage.from('exam-marking-keys').download(exam.marking_key_path)
  if(fileError||!file)return json({error:'The marking key could not be read: '+(fileError?.message||'unknown storage error')},500)
  const mime=exam.marking_key_mime_type||file.type||'application/pdf'
  if(!(mime==='application/pdf'||mime.startsWith('image/')||mime==='text/plain'))return json({error:'AI marking supports pasted text, PDF or image marking keys.'},415)
  const bytes=new Uint8Array(await file.arrayBuffer());if(bytes.byteLength>15*1024*1024)return json({error:'The marking key is larger than 15 MB.'},413)
  const keyContent=mime==='text/plain'?new TextDecoder().decode(bytes):toBase64(bytes)
  if(mime==='text/plain'&&!keyContent.trim())return json({error:'The pasted marking key is empty.'},422)
  const{data:questions,error:qError}=await admin.from('exam_questions').select('id,question_number,question_type,question_text,marks,sort_order,ai_marking_enabled').eq('exam_id',exam.id).order('sort_order');if(qError)throw qError
  const{data:answers,error:aError}=await admin.from('exam_answers').select('id,question_id,answer_text,answer_json,selected_option_key,dropdown_value,matching_response').eq('attempt_id',attempt.id);if(aError)throw aError
  const byQ=new Map((answers??[]).map((a:any)=>[a.question_id,a]))
  const items=(questions??[]).filter((q:any)=>q.ai_marking_enabled!==false).map((q:any)=>{const a:any=byQ.get(q.id);return{question_id:q.id,answer_id:a?.id??null,number:q.question_number,type:q.question_type,question:q.question_text??'',max_marks:Number(q.marks??0),student_answer:a?{text:a.answer_text,selected_option_key:a.selected_option_key,dropdown_value:a.dropdown_value,matching_response:a.matching_response,answer_json:a.answer_json}:null}})
  const prompt=['You are the OLP Homework Hub marking assistant.','The provided teacher marking key is authoritative for: '+exam.title,'Use that marking key as the authority. Mark every supplied question. Match by printed question number and wording. Never invent marking rules. Blank or missing responses score 0. If uncertain set needs_teacher_review=true.','Return JSON only: {"results":[{"question_id":"uuid","answer_id":"uuid-or-null","number":"1(a)","max_marks":1,"ai_mark":1,"confidence":0.95,"needs_teacher_review":false,"feedback":"brief reason","awarded_points":[],"missing_points":[]}]}','QUESTIONS AND STUDENT ANSWERS:',JSON.stringify(items)].join('\n\n')
  const{error:statusError}=await admin.from('exam_attempts').update({status:'marking'}).eq('id',attempt.id);if(statusError)throw statusError
  const g=await gemini(key,mime,keyContent,prompt)
  if(!g.ok){await admin.from('exam_attempts').update({status:originalStatus}).eq('id',attempt.id);const detail=g.attempts.map((a:any)=>a.model+' '+a.status+': '+a.error).join(' | ');console.error('[exam-ai-mark]',JSON.stringify({stage:'gemini_failed',attempts:g.attempts}));return json({error:'AI marking service could not process the marking key.',detail,code:'AI_MARKING_PROVIDER_FAILED',retryable:g.attempts.some((a:any)=>[0,408,429,500,502,503,504].includes(a.status))},502)}
  const aiText=g.payload?.candidates?.[0]?.content?.parts?.map((p:any)=>p.text??'').join('')??''
  let parsed:any;try{parsed=JSON.parse(cleanJson(aiText))}catch{await admin.from('exam_attempts').update({status:originalStatus}).eq('id',attempt.id);return json({error:'AI returned invalid marking data. No marks were saved.',detail:aiText.slice(0,500)},502)}
  if(!Array.isArray(parsed.results)||parsed.results.length===0){await admin.from('exam_attempts').update({status:originalStatus}).eq('id',attempt.id);return json({error:'AI returned no question results. No marks were saved.'},502)}
  const valid=new Map(items.map((x:any)=>[x.question_id,x]));let total=0,saved=0
  for(const result of parsed.results){const item:any=valid.get(String(result.question_id??''));if(!item?.answer_id)continue;const max=Math.max(0,Number(item.max_marks||0)),mark=Math.min(max,Math.max(0,Number(result.ai_mark??0))),confidence=Math.min(1,Math.max(0,Number(result.confidence??0)));const{error:e}=await admin.from('exam_mark_results').upsert({answer_id:item.answer_id,method:'ai',max_marks:max,ai_mark:mark,final_mark:null,awarded_points:Array.isArray(result.awarded_points)?result.awarded_points:[],missing_points:Array.isArray(result.missing_points)?result.missing_points:[],feedback:typeof result.feedback==='string'?result.feedback:null,ai_confidence:confidence,ai_model:g.model,ai_rationale:{needs_teacher_review:result.needs_teacher_review===true,question_number:item.number},reviewed_by:null,reviewed_at:null},{onConflict:'answer_id'});if(e)throw e;total+=mark;saved++}
  if(saved===0){await admin.from('exam_attempts').update({status:originalStatus}).eq('id',attempt.id);return json({error:'AI results could not be matched to saved student answers. No marks were saved.'},502)}
  const{error:finishError}=await admin.from('exam_attempts').update({status:'marked',ai_mark:total,ai_marked_at:new Date().toISOString(),final_mark:null}).eq('id',attempt.id);if(finishError)throw finishError
  return json({ok:true,attempt_id:attempt.id,ai_mark:total,question_results:saved,requires_teacher_review:true,model:g.model})
 }catch(error){console.error('[exam-ai-mark]',error);if(admin&&attemptId)await admin.from('exam_attempts').update({status:originalStatus}).eq('id',attemptId);return json({error:'AI marking failed safely. No result was returned to the student.',detail:error instanceof Error?error.message:String(error),code:'AI_MARKING_FAILED'},500)}
})