import { useEffect, useMemo, useState } from 'react'
import { Lock, MessageCircle, Pin, Plus, RotateCcw, Search, Send, Trash2, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import './Discussions.compact.css'

type UserRole = 'platform_owner' | 'teacher' | 'student' | 'admin' | 'parent'
type ClassRow = { id:string; name:string; created_by:string; is_active:boolean }
type SubjectRow = { id:string; class_id:string; name:string }
type DiscussionRow = { id:string; class_id:string; subject_id:string; created_by:string; title:string; body:string; is_pinned:boolean; status:'open'|'closed'; created_at:string; updated_at:string; closed_at:string|null; closed_by:string|null }
type PostRow = { id:string; discussion_id:string; created_by:string; body:string; parent_post_id:string|null; created_at:string; updated_at:string }
type ProfileRow = { id:string; full_name:string|null }
type DiscussionImage = { id:string; discussion_id:string; post_id:string|null; storage_path:string }
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024
function validateScreenshot(file:File) {
  if(!['image/png','image/jpeg','image/webp'].includes(file.type)) throw new Error('Use a PNG, JPG or WebP screenshot.')
  if(file.size>MAX_SCREENSHOT_BYTES) throw new Error('Screenshots must be 5 MB or smaller.')
}
function ScreenshotPreview({file,onRemove}:{file:File|null;onRemove:()=>void}) {
  const [url,setUrl]=useState('')
  useEffect(()=>{if(!file){setUrl('');return}const objectUrl=URL.createObjectURL(file);setUrl(objectUrl);return ()=>URL.revokeObjectURL(objectUrl)},[file])
  return file?<div className="discussion-screenshot-preview">{url&&<img src={url} alt="Screenshot ready to post"/>}<button type="button" onClick={onRemove}>Remove screenshot</button></div>:null
}

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
  const [filterClassId,setFilterClassId] = useState('')
  const [filterSubjectId,setFilterSubjectId] = useState('')
  const [showForm,setShowForm] = useState(false)
  const [form,setForm] = useState(blankForm)
  const [reply,setReply] = useState('')
  const [replyToPostId,setReplyToPostId] = useState<string|null>(null)
  const [promptScreenshot,setPromptScreenshot] = useState<File|null>(null)
  const [replyScreenshot,setReplyScreenshot] = useState<File|null>(null)
  const [images,setImages] = useState<DiscussionImage[]>([])
  const [imageUrls,setImageUrls] = useState<Record<string,string>>({})
  function acceptScreenshot(file:File,kind:'prompt'|'reply') {
    try { validateScreenshot(file);(kind==='prompt'?setPromptScreenshot:setReplyScreenshot)(file);setError('') }
    catch(err){setError(err instanceof Error?err.message:'Invalid screenshot.')}
  }
  function handlePaste(e:React.ClipboardEvent<HTMLTextAreaElement>,kind:'prompt'|'reply') {
    const file=Array.from(e.clipboardData.items).find(item=>item.kind==='file'&&item.type.startsWith('image/'))?.getAsFile()
    if(file){e.preventDefault();acceptScreenshot(file,kind)}
  }
  async function uploadScreenshot(file:File,discussionId:string,postId:string|null) {
    validateScreenshot(file)
    const extension=file.type==='image/png'?'png':file.type==='image/webp'?'webp':'jpg'
    const storagePath=`${discussionId}/${userId}/${crypto.randomUUID()}.${extension}`
    const {error:uploadError}=await supabase.storage.from('discussion-images').upload(storagePath,file,{contentType:file.type,upsert:false})
    if(uploadError) throw new Error(uploadError.message)
    const {error:recordError}=await supabase.from('discussion_images').insert({discussion_id:discussionId,post_id:postId,storage_path:storagePath,uploaded_by:userId})
    if(recordError){await supabase.storage.from('discussion-images').remove([storagePath]);throw new Error(recordError.message)}
  }
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [message,setMessage] = useState('')

  const isStaff = role === 'teacher' || role === 'platform_owner'
  const selected = discussions.find(d=>d.id===selectedId) ?? null
  const selectedPosts = posts.filter(p=>p.discussion_id===selectedId)
  const replyTarget = selectedPosts.find(p=>p.id===replyToPostId)??null
  const rootPosts = selectedPosts.filter(p=>!p.parent_post_id||!selectedPosts.some(parent=>parent.id===p.parent_post_id))
  function renderPost(post:PostRow,depth=0):React.ReactNode {
    const children=selectedPosts.filter(p=>p.parent_post_id===post.id)
    return <article className="discussion-post" key={post.id} style={{marginLeft:Math.min(depth,4)*16,borderLeft:depth?'3px solid var(--border-color, #d6dbe5)':undefined,paddingLeft:depth?'12px':undefined}}>
      <div><strong>{personName(post.created_by)}</strong><small>{formatDate(post.created_at)}</small></div>
      {post.parent_post_id&&<small className="muted">Reply to {personName(selectedPosts.find(p=>p.id===post.parent_post_id)?.created_by??'')}</small>}
      <p>{post.body}</p>
      {images.filter(img=>img.post_id===post.id).map(img=>imageUrls[img.id]&&<a key={img.id} href={imageUrls[img.id]} target="_blank" rel="noreferrer"><img className="discussion-attached-image" src={imageUrls[img.id]} alt="Reply screenshot"/></a>)}
      {selected?.status==='open'&&<button type="button" className="secondary" onClick={()=>{setReplyToPostId(post.id);setReply('')}}>↳ Reply to {personName(post.created_by)}</button>}
      {(post.created_by===userId||isStaff)&&<button type="button" className="discussion-delete-post" onClick={()=>deletePost(post)} title="Delete reply"><Trash2 size={15}/></button>}
      {children.map(child=>renderPost(child,depth+1))}
    </article>
  }
  const formSubjects = subjects.filter(s=>s.class_id===form.classId)
  const filterSubjects = subjects.filter(s=>s.class_id===filterClassId)
  const discussionCountForSubject = (subjectId:string) => discussions.filter(d=>d.subject_id===subjectId).length
  const visible = useMemo(()=>{
    const q=search.trim().toLowerCase()
    return [...discussions].filter(d=>(!filterClassId||d.class_id===filterClassId)&&(!filterSubjectId||d.subject_id===filterSubjectId)).sort((a,b)=>Number(b.is_pinned)-Number(a.is_pinned)||new Date(b.updated_at).getTime()-new Date(a.updated_at).getTime()).filter(d=>{
      if(!q) return true
      const c=classes.find(x=>x.id===d.class_id)?.name ?? ''
      const s=subjects.find(x=>x.id===d.subject_id)?.name ?? ''
      return [d.title,d.body,c,s,d.status].join(' ').toLowerCase().includes(q)
    })
  },[discussions,classes,subjects,search,filterClassId,filterSubjectId])

  const className=(id:string)=>classes.find(c=>c.id===id)?.name ?? 'Class'
  const subjectName=(id:string)=>subjects.find(s=>s.id===id)?.name ?? 'Subject'
  const personName=(id:string)=>profiles.find(p=>p.id===id)?.full_name || (id===userId?'You':'Participant')

  async function loadAll() {
    const [classResult,subjectResult,discussionResult,postResult,imageResult] = await Promise.all([
      supabase.from('classes').select('id,name,created_by,is_active').order('name'),
      supabase.from('class_subjects').select('id,class_id,name').order('name'),
      supabase.from('discussions').select('*').order('created_at',{ascending:false}),
      supabase.from('discussion_posts').select('*').order('created_at',{ascending:true}),
      supabase.from('discussion_images').select('id,discussion_id,post_id,storage_path'),
    ])
    if(classResult.error) throw classResult.error
    if(subjectResult.error) throw subjectResult.error
    if(discussionResult.error) throw discussionResult.error
    if(postResult.error) throw postResult.error
    if(imageResult.error) throw imageResult.error
    const loadedClasses=(classResult.data??[]) as ClassRow[]
    const loadedSubjects=(subjectResult.data??[]) as SubjectRow[]
    const loadedDiscussions=(discussionResult.data??[]) as DiscussionRow[]
    const loadedPosts=(postResult.data??[]) as PostRow[]
    const imageRows=(imageResult.data??[]) as DiscussionImage[]
    setImages(imageRows)
    const signed=await Promise.all(imageRows.map(async img=>{
      const {data}=await supabase.storage.from('discussion-images').createSignedUrl(img.storage_path,3600)
      return [img.id,data?.signedUrl??''] as const
    }))
    setImageUrls(Object.fromEntries(signed))
    setClasses(loadedClasses); setSubjects(loadedSubjects); setDiscussions(loadedDiscussions); setPosts(loadedPosts)
    const pr=await supabase.rpc('get_discussion_participant_names')
    if(!pr.error) setProfiles((pr.data??[]) as ProfileRow[])
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

  // Keep other participants' screens in sync through Supabase Postgres Changes.
  // Reads are made with the signed-in user's existing RLS permissions.
  useEffect(() => {
    if (!userId || loading) return
    let active = true

    const refreshNames = async () => {
      const result = await supabase.rpc('get_discussion_participant_names')
      if (active && !result.error) setProfiles((result.data ?? []) as ProfileRow[])
    }

    const channel = supabase.channel(`olp-discussions-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussion_posts' }, async payload => {
        if (!active) return
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) setPosts(current => current.filter(post => post.id !== id))
          return
        }
        const id = (payload.new as { id?: string }).id
        if (!id) return
        // Query again rather than trusting a broadcast payload for access control.
        const result = await supabase.from('discussion_posts').select('*').eq('id', id).maybeSingle()
        if (!active || result.error || !result.data) return
        const incoming = result.data as PostRow
        setPosts(current => [...current.filter(post => post.id !== incoming.id), incoming]
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
        void refreshNames()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'discussions' }, async payload => {
        if (!active) return
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string }).id
          if (id) {
            setDiscussions(current => current.filter(d => d.id !== id))
            setPosts(current => current.filter(post => post.discussion_id !== id))
            setSelectedId(current => current === id ? null : current)
          }
          return
        }
        const id = (payload.new as { id?: string }).id
        if (!id) return
        const result = await supabase.from('discussions').select('*').eq('id', id).maybeSingle()
        if (!active || result.error || !result.data) return
        const incoming = result.data as DiscussionRow
        setDiscussions(current => [...current.filter(d => d.id !== incoming.id), incoming])
        void refreshNames()
      })
      .subscribe(status => {
        if (active && (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT')) {
          console.warn('Discussion live updates disconnected:', status)
        }
      })

    return () => { active = false; void supabase.removeChannel(channel) }
  }, [userId, loading])

  function openCreate(){
    const first=classes.find(c=>c.is_active)??classes[0]
    const firstSubject=subjects.find(s=>s.class_id===first?.id)
    setForm({classId:first?.id??'',subjectId:firstSubject?.id??'',title:'',body:''})
    setPromptScreenshot(null);setShowForm(true); setError(''); setMessage('')
  }

  async function createDiscussion(e:React.FormEvent){
    e.preventDefault(); if(!userId) return
    if(!form.classId||!form.subjectId||!form.title.trim()||!form.body.trim()) return setError('Class, subject, title and opening question are required.')
    try{
      setBusy(true); setError('')
      const {data,error:insertError}=await supabase.from('discussions').insert({class_id:form.classId,subject_id:form.subjectId,created_by:userId,title:form.title.trim(),body:form.body.trim()}).select('*').single()
      if(insertError) throw insertError
      let notice='Discussion started.'
      if(promptScreenshot){try{await uploadScreenshot(promptScreenshot,data.id,null)}catch(uploadError){notice='Discussion started, but screenshot upload failed: '+(uploadError instanceof Error?uploadError.message:'Unknown error')}}
      setPromptScreenshot(null);setShowForm(false); setForm(blankForm); setMessage(notice); await loadAll(); setSelectedId(data.id)
    }catch(err){setError(err instanceof Error?err.message:'Could not start discussion.')}finally{setBusy(false)}
  }

  async function addReply(e:React.FormEvent){
    e.preventDefault(); if(!selected||(!reply.trim()&&!replyScreenshot)) return
    try{
      setBusy(true); setError('')
      const {data:createdPost,error:insertError}=await supabase.from('discussion_posts')
        .insert({discussion_id:selected.id,created_by:userId,parent_post_id:replyToPostId,body:reply.trim() || (replyScreenshot ? 'Screenshot attached' : '')})
        .select('*').single()
      if(insertError) throw insertError
      // Update this thread immediately after the database confirms the insert.
      // Deduplicate by database ID if a subsequent refresh also loads this reply.
      setPosts(current => current.some(post => post.id === createdPost.id)
        ? current
        : [...current, createdPost as PostRow])
      let notice=''
      if(replyScreenshot){try{await uploadScreenshot(replyScreenshot,selected.id,createdPost.id)}catch(uploadError){notice='Reply posted, but screenshot upload failed: '+(uploadError instanceof Error?uploadError.message:'Unknown error')}}
      setReply('');setReplyScreenshot(null);setReplyToPostId(null)
      await loadAll()
      if(notice)setMessage(notice)
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
      <label className="discussion-wide">Opening question / prompt<textarea value={form.body} maxLength={10000} onChange={e=>setForm(f=>({...f,body:e.target.value}))} rows={5} placeholder="Write the question or prompt learners should discuss." onPaste={e=>handlePaste(e,'prompt')}/></label>
      <div className="discussion-wide"><label className="discussion-image-picker">Attach screenshot (or paste with Ctrl + V)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)acceptScreenshot(file,'prompt');e.target.value=''}}/></label><ScreenshotPreview file={promptScreenshot} onRemove={()=>setPromptScreenshot(null)}/></div>
      <div className="discussion-wide discussion-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancel</button><button className="primary" disabled={busy}>Start discussion</button></div>
    </form></section>}

    <section className="panel" style={{marginBottom:'16px'}}>
      <div className="panel-heading"><div><h3>Browse by class and subject</h3><p>Choose a class, then a subject, to find its discussions quickly.</p></div></div>
      <div style={{display:'flex',gap:'12px',flexWrap:'wrap',alignItems:'end'}}>
        <label style={{flex:'1 1 190px'}}>Class
          <select value={filterClassId} onChange={e=>{setFilterClassId(e.target.value);setFilterSubjectId('');setSelectedId(null)}}>
            <option value="">All classes</option>
            {classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label style={{flex:'1 1 190px'}}>Subject
          <select value={filterSubjectId} disabled={!filterClassId} onChange={e=>{setFilterSubjectId(e.target.value);setSelectedId(null)}}>
            <option value="">All subjects</option>
            {filterSubjects.map(subject=><option key={subject.id} value={subject.id}>{subject.name} ({discussionCountForSubject(subject.id)})</option>)}
          </select>
        </label>
        {(filterClassId||filterSubjectId)&&<button type="button" className="secondary" onClick={()=>{setFilterClassId('');setFilterSubjectId('');setSelectedId(null)}}>Show all discussions</button>}
      </div>
      {filterClassId&&<p className="muted" style={{marginTop:'10px'}}>{className(filterClassId)}{filterSubjectId?' · '+subjectName(filterSubjectId):' · All subjects'} · {visible.length} discussion{visible.length===1?'':'s'}</p>}
    </section>
    <section className="discussion-layout">
      <div className="panel discussion-list"><div className="panel-heading"><div><h3>Class discussions</h3><p>{visible.length} discussion{visible.length===1?'':'s'} in this view</p></div></div><div className="discussion-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search discussions"/></div>
        {visible.length===0?<div className="empty-state"><MessageCircle size={34}/><strong>No discussions yet</strong><p>{isStaff?'Start the first classroom discussion.':'Your class discussions will appear here.'}</p></div>:<div className="discussion-items">{visible.map(d=><button key={d.id} className={`discussion-item ${selectedId===d.id?'selected':''}`} onClick={()=>{setSelectedId(d.id);setReplyToPostId(null)}}><div className="discussion-item-top"><strong>{d.is_pinned&&<Pin size={14}/>} {d.title}</strong><span className={`discussion-status ${d.status}`}>{d.status}</span></div><small>{className(d.class_id)} · {subjectName(d.subject_id)}</small><small>{posts.filter(p=>p.discussion_id===d.id).length} replies · {formatDate(d.created_at)}</small></button>)}</div>}
      </div>

      <div className="panel discussion-thread">{!selected?<div className="empty-state"><MessageCircle size={34}/><strong>Select a discussion</strong><p>Choose a discussion to read and participate.</p></div>:<>
        <div className="discussion-thread-head"><div><div className="discussion-title-row"><h3>{selected.title}</h3><span className={`discussion-status ${selected.status}`}>{selected.status}</span></div><p>{className(selected.class_id)} · {subjectName(selected.subject_id)} · {personName(selected.created_by)}</p></div>{isStaff&&<div className="discussion-controls"><button className="secondary" onClick={togglePin} disabled={busy}><Pin size={16}/>{selected.is_pinned?'Unpin':'Pin'}</button>{selected.status==='open'?<button className="secondary" onClick={()=>setStatus('closed')} disabled={busy}><Lock size={16}/>Close</button>:<button className="secondary" onClick={()=>setStatus('open')} disabled={busy}><RotateCcw size={16}/>Reopen</button>}<button className="secondary danger-button" onClick={deleteDiscussion} disabled={busy}><Trash2 size={16}/>Delete</button></div>}</div>
        <article className="discussion-prompt"><small>Opening question · {formatDate(selected.created_at)}</small><p>{selected.body}</p>{images.filter(img=>img.discussion_id===selected.id&&!img.post_id).map(img=>imageUrls[img.id]&&<a key={img.id} href={imageUrls[img.id]} target="_blank" rel="noreferrer"><img className="discussion-attached-image" src={imageUrls[img.id]} alt="Discussion screenshot"/></a>)}</article>
        <div className="discussion-replies"><h3>Replies ({selectedPosts.length})</h3>{selectedPosts.length===0?<p className="muted">No replies yet.</p>:rootPosts.map(post=>renderPost(post))}</div>
        {selected.status==='open'?<form className="discussion-reply" onSubmit={addReply}>{replyTarget&&<div className="discussion-reply-target"><strong>Replying to {personName(replyTarget.created_by)}</strong><button type="button" className="secondary" onClick={()=>setReplyToPostId(null)}>Cancel reply</button></div>}<textarea value={reply} onChange={e=>setReply(e.target.value)} onPaste={e=>handlePaste(e,'reply')} rows={3} maxLength={10000} placeholder="Write your reply or paste a screenshot (Ctrl + V)..."/><label className="discussion-image-picker">Screenshot<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const file=e.target.files?.[0];if(file)acceptScreenshot(file,'reply');e.target.value=''}}/></label><ScreenshotPreview file={replyScreenshot} onRemove={()=>setReplyScreenshot(null)}/><button className="primary" disabled={busy||(!reply.trim()&&!replyScreenshot)}><Send size={17}/>Post reply</button></form>:<div className="discussion-closed-note"><Lock size={17}/><span>This discussion is closed. Previous contributions remain available to read.</span></div>}
      </>}</div>
    </section>
  </main>
}
