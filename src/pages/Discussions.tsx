import { useEffect, useMemo, useState } from 'react'
import { Lock, MessageCircle, Pin, Plus, RotateCcw, Search, Send, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'

type UserRole = 'platform_owner' | 'teacher' | 'student' | 'admin' | 'parent'
type ClassRow = { id:string; name:string; created_by:string; is_active:boolean }
type SubjectRow = { id:string; class_id:string; name:string }
type DiscussionRow = { id:string; class_id:string; subject_id:string; created_by:string; title:string; body:string; is_pinned:boolean; status:'open'|'closed'; created_at:string; updated_at:string; closed_at:string|null; closed_by:string|null }
type PostRow = { id:string; discussion_id:string; created_by:string; body:string; parent_post_id:string|null; created_at:string; updated_at:string }
type ProfileRow = { id:string; full_name:string|null }

const blankForm = { classId:'', subjectId:'', title:'', body:'' }
const formatDate = (value:string) => new Date(value).toLocaleString()

export default function Discussions() {
  const [role,setRole] = useState<UserRole|null>(null)
  const [userId,setUserId] = useState('')
  const [classes,setClasses] = useState<ClassRow[]>([])
  const [subjects,setSubjects] = useState<SubjectRow[]>([])
  const [discussions,setDiscussions] = useState<DiscussionRow[]>([])
  const [posts,setPosts] = useState<PostRow[]>([])
  const [profiles,setProfiles] = useState<ProfileRow[]>([])
  const [selectedId,setSelectedId] = useState<string|null>(null)
  const [search,setSearch] = useState('')
  const [showForm,setShowForm] = useState(false)
  const [form,setForm] = useState(blankForm)
  const [reply,setReply] = useState('')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')

  const isStaff = role === 'teacher' || role === 'platform_owner'
  const selected = discussions.find(d=>d.id===selectedId) ?? null
  const selectedPosts = posts.filter(p=>p.discussion_id===selectedId)
  const formSubjects = subjects.filter(s=>s.class_id===form.classId)
  const visible = useMemo(()=>{
    const q=search.trim().toLowerCase()
    return [...discussions].sort((a,b)=>Number(b.is_pinned)-Number(a.is_pinned)||new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()).filter(d=>{
      if(!q) return true
      const c=classes.find(x=>x.id===d.class_id)?.name ?? ''
      const s=subjects.find(x=>x.id===d.subject_id)?.name ?? ''
      return [d.title,d.body,c,s,d.status].join(' ').toLowerCase().includes(q)
    })
  },[discussions,classes,subjects,search])

  const className=(id:string)=>classes.find(c=>c.id===id)?.name ?? 'Class'
  const subjectName=(id:string)=>subjects.find(s=>s.id===id)?.name ?? 'Subject'
  const personName=(id:string)=>profiles.find(p=>p.id===id)?.full_name || (id===userId?'You':'Participant')

  async function loadAll() {
    const [classResult,subjectResult,discussionResult,postResult] = await Promise.all([
      supabase.from('classes').select('id,name,created_by,is_active').order('name'),
      supabase.from('class_subjects').select('id,class_id,name').order('name'),
      supabase.from('discussions').select('*').order('created_at',{ascending:false}),
      supabase.from('discussion_posts').select('*').order('created_at',{ascending:true}),
    ])
    if(classResult.error) throw classResult.error
    if(subjectResult.error) throw subjectResult.error
    if(discussionResult.error) throw discussionResult.error
    if(postResult.error) throw postResult.error
    const loadedClasses=(classResult.data??[]) as ClassRow[]
    const loadedSubjects=(subjectResult.data??[]) as SubjectRow[]
    const loadedDiscussions=(discussionResult.data??[]) as DiscussionRow[]
    const loadedPosts=(postResult.data??[]) as PostRow[]
    setClasses(loadedClasses); setSubjects(loadedSubjects); setDiscussions(loadedDiscussions); setPosts(loadedPosts)
    const ids=[...new Set([...loadedDiscussions.map(d=>d.created_by),...loadedPosts.map(p=>p.created_by)])]
    if(ids.length){
      const pr=await supabase.from('profiles').select('id,full_name').in('id',ids)
      if(!pr.error) setProfiles((pr.data??[]) as ProfileRow[])
    }
    setSelectedId(current=>current && loadedDiscussions.some(d=>d.id===current) ? current : loadedDiscussions[0]?.id ?? null)
  }

  useEffect(()=>{ void (async()=>{
    try{
      const {data:{user},error:authError}=await supabase.auth.getUser()
      if(authError) throw authError
      if(!user) throw new Error('You must be signed in.')
      const {data:profile,error:profileError}=await supabase.from('profiles').select('role,full_name').eq('id',user.id).single()
      if(profileError) throw profileError
      setUserId(user.id); setRole(profile.role as UserRole)
      setProfiles([{id:user.id,full_name:profile.full_name??null}])
      await loadAll()
    }catch(err){setError(err instanceof Error?err.message:'Could not load discussions.')}
    finally{setLoading(false)}
  })() },[])

  function openCreate(){
    const first=classes.find(c=>c.is_active)??classes[0]
    const firstSubject=subjects.find(s=>s.class_id===first?.id)
    setForm({classId:first?.id??'',subjectId:firstSubject?.id??'',title:'',body:''})
    setShowForm(true); setError(''); setMessage('')
  }

  async function createDiscussion(e:React.FormEvent){
    e.preventDefault(); if(!userId) return
    if(!form.classId||!form.subjectId||!form.title.trim()||!form.body.trim()) return setError('Class, subject, title and opening question are required.')
    try{
      setBusy(true); setError('')
      const {data,error:insertError}=await supabase.from('discussions').insert({class_id:form.classId,subject_id:form.subjectId,created_by:userId,title:form.title.trim(),body:form.body.trim()}).select('*').single()
      if(insertError) throw insertError
      setShowForm(false); setForm(blankForm); setMessage('Discussion started.'); await loadAll(); setSelectedId(data.id)
    }catch(err){setError(err instanceof Error?err.message:'Could not start discussion.')}finally{setBusy(false)}
  }

  async function addReply(e:React.FormEvent){
    e.preventDefault(); if(!selected||!reply.trim()) return
    try{
      setBusy(true); setError('')
      const replyBody=reply.trim()
      const {data:newPost,error:insertError}=await supabase.from('discussion_posts').insert({discussion_id:selected.id,created_by:userId,body:replyBody}).select('*').single()
      if(insertError) throw insertError
      setReply('')
      if(newPost) setPosts(current=>[...current.filter(p=>p.id!==newPost.id),newPost as PostRow].sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()))
    }catch(err){setError(err instanceof Error?err.message:'Could not post reply.')}finally{setBusy(false)}
  }

  async function setStatus(status:'open'|'closed'){
    if(!selected) return
    try{
      setBusy(true); setError('')
      const values=status==='closed'?{status,closed_at:new Date().toISOString(),closed_by:userId}:{status,closed_at:null,closed_by:null}
      const {error:updateError}=await supabase.from('discussions').update(values).eq('id',selected.id)
      if(updateError) throw updateError
      setMessage(status==='closed'?'Discussion closed. Students can still read it.':'Discussion reopened.'); await loadAll()
    }catch(err){setError(err instanceof Error?err.message:'Could not change discussion status.')}finally{setBusy(false)}
  }

  async function togglePin(){ if(!selected)return; try{setBusy(true);const {error:e}=await supabase.from('discussions').update({is_pinned:!selected.is_pinned}).eq('id',selected.id);if(e)throw e;await loadAll()}catch(err){setError(err instanceof Error?err.message:'Could not update pin.')}finally{setBusy(false)} }
  async function deleteDiscussion(){ if(!selected||!confirm(`Delete “${selected.title}” and all its replies?`))return; try{setBusy(true);const {error:e}=await supabase.from('discussions').delete().eq('id',selected.id);if(e)throw e;setMessage('Discussion deleted.');setSelectedId(null);await loadAll()}catch(err){setError(err instanceof Error?err.message:'Could not delete discussion.')}finally{setBusy(false)} }
  async function deletePost(post:PostRow){ if(!confirm('Delete this reply?'))return; try{const {error:e}=await supabase.from('discussion_posts').delete().eq('id',post.id);if(e)throw e;await loadAll()}catch(err){setError(err instanceof Error?err.message:'Could not delete reply.')} }

  if(loading) return <main className="main"><div className="empty-state"><MessageCircle size={34}/><strong>Loading discussions...</strong></div></main>
  if(role!=='teacher'&&role!=='platform_owner'&&role!=='student') return <main className="main"><div className="empty-state"><MessageCircle size={34}/><strong>Discussions are not available for this role yet.</strong></div></main>

  return <main className="main discussions-page">
    <header className="topbar"><div><p className="eyebrow">{isStaff?'CLASSROOM WORKSPACE':'STUDENT WORKSPACE'}</p><h1>Discussions</h1></div></header>
    {error&&<p className="admin-message admin-message-error">{error}</p>}{message&&<p className="admin-message admin-message-success">{message}</p>}
    <section className="welcome"><div><p className="eyebrow">CLASS DISCUSSIONS</p><h2>Learn, ask and contribute.</h2><p className="muted">Join class discussions, share ideas and respond to questions from your teacher and classmates.</p></div>{isStaff&&<button className="primary" onClick={openCreate}><Plus size={18}/>Start discussion</button>}</section>

    {showForm&&isStaff&&<section className="panel discussion-create"><div className="panel-heading"><div><h3>Start a discussion</h3><p>Choose the class and subject, then give learners a clear opening question.</p></div><button className="icon-button" onClick={()=>setShowForm(false)}><X size={18}/></button></div><form onSubmit={createDiscussion} className="discussion-form">
      <label>Class<select value={form.classId} onChange={e=>{const classId=e.target.value;setForm(f=>({...f,classId,subjectId:subjects.find(s=>s.class_id===classId)?.id??''}))}}><option value="">Select class</option>{classes.filter(c=>c.is_active).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Subject<select value={form.subjectId} onChange={e=>setForm(f=>({...f,subjectId:e.target.value}))}><option value="">Select subject</option>{formSubjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="discussion-wide">Discussion title<input value={form.title} maxLength={200} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. How do food chains change?"/></label>
      <label className="discussion-wide">Opening question / prompt<textarea value={form.body} maxLength={10000} onChange={e=>setForm(f=>({...f,body:e.target.value}))} rows={5} placeholder="Write the question or prompt learners should discuss."/></label>
      <div className="discussion-wide discussion-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary" disabled={busy}>Start discussion</button></div>
    </form></section>}

    <section className="discussion-layout">
      <div className="panel discussion-list"><div className="panel-heading"><div><h3>Class discussions</h3><p>{discussions.length} discussion{discussions.length===1?'':'s'} available</p></div></div><div className="discussion-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search discussions"/></div>
        {visible.length===0?<div className="empty-state"><MessageCircle size={34}/><strong>No discussions yet</strong><p>{isStaff?'Start the first classroom discussion.':'Your class discussions will appear here.'}</p></div>:<div className="discussion-items">{visible.map(d=><button key={d.id} className={`discussion-item ${selectedId===d.id?'selected':''}`} onClick={()=>setSelectedId(d.id)}><div className="discussion-item-top"><strong>{d.is_pinned&&<Pin size={14}/>} {d.title}</strong><span className={`discussion-status ${d.status}`}>{d.status}</span></div><small>{className(d.class_id)} · {subjectName(d.subject_id)}</small><small>{posts.filter(p=>p.discussion_id===d.id).length} replies · {formatDate(d.created_at)}</small></button>)}</div>}
      </div>

      <div className="panel discussion-thread">{!selected?<div className="empty-state"><MessageCircle size={34}/><strong>Select a discussion</strong><p>Choose a discussion to read and participate.</p></div>:<>
        <div className="discussion-thread-head"><div><div className="discussion-title-row"><h3>{selected.title}</h3><span className={`discussion-status ${selected.status}`}>{selected.status}</span></div><p>{className(selected.class_id)} · {subjectName(selected.subject_id)} · {personName(selected.created_by)}</p></div>{isStaff&&<div className="discussion-controls"><button className="secondary" onClick={togglePin} disabled={busy}><Pin size={16}/>{selected.is_pinned?'Unpin':'Pin'}</button>{selected.status==='open'?<button className="secondary" onClick={()=>setStatus('closed')} disabled={busy}><Lock size={16}/>Close</button>:<button className="secondary" onClick={()=>setStatus('open')} disabled={busy}><RotateCcw size={16}/>Reopen</button>}<button className="secondary danger-button" onClick={deleteDiscussion} disabled={busy}><Trash2 size={16}/>Delete</button></div>}</div>
        <article className="discussion-prompt"><small>Opening question · {formatDate(selected.created_at)}</small><p>{selected.body}</p></article>
        <div className="discussion-replies"><h3>Replies ({selectedPosts.length})</h3>{selectedPosts.length===0?<p className="muted">No replies yet.</p>:selectedPosts.map(p=><article className="discussion-post" key={p.id}><div><strong>{personName(p.created_by)}</strong><small>{formatDate(p.created_at)}</small></div><p>{p.body}</p>{(p.created_by===userId||isStaff)&&<button className="discussion-delete-post" onClick={()=>deletePost(p)} title="Delete reply"><Trash2 size={15}/></button>}</article>)}</div>
        {selected.status==='open'?<form className="discussion-reply" onSubmit={addReply}><textarea value={reply} onChange={e=>setReply(e.target.value)} rows={3} maxLength={10000} placeholder="Write your reply..."/><button className="primary" disabled={busy||!reply.trim()}><Send size={17}/>Post reply</button></form>:<div className="discussion-closed-note"><Lock size={17}/><span>This discussion is closed. Previous contributions remain available to read.</span></div>}
      </>}</div>
    </section>
  </main>
}
