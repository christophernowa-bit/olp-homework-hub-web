import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { MessageCircle, Send, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Conversation = { id: string; teacher_id: string; created_at: string }
type ChatMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }
type Teacher = { id: string; full_name: string | null }

export default function OwnerSupportInbox() {
  const [ownerId, setOwnerId] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const loadConversations = useCallback(async () => {
    const { data, error: queryError } = await supabase.from('teacher_support_conversations')
      .select('id, teacher_id, created_at').order('created_at', { ascending: false })
    if (queryError) { setError(queryError.message); return }
    const rows = data ?? []
    setConversations(rows)
    const ids = [...new Set(rows.map(row => row.teacher_id))]
    if (ids.length) {
      const { data: names, error: namesError } = await supabase.from('profiles').select('id,full_name').in('id', ids)
      if (namesError) setError(namesError.message)
      else setTeachers(names ?? [])
    } else setTeachers([])
    if (!selectedId && rows.length) setSelectedId(rows[0].id)
    if (selectedId && !rows.some(row => row.id === selectedId)) setSelectedId(rows[0]?.id ?? '')
    setLoading(false)
  }, [selectedId])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setOwnerId(user.id)
      await loadConversations()
    }
    void init()
    const timer = window.setInterval(() => void loadConversations(), 5000)
    return () => window.clearInterval(timer)
  }, [loadConversations])

  const loadMessages = useCallback(async () => {
    if (!selectedId) { setMessages([]); return }
    const { data, error: queryError } = await supabase.from('teacher_support_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', selectedId).order('created_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setMessages(data ?? [])
  }, [selectedId])

  useEffect(() => { void loadMessages() }, [loadMessages])

  const selected = conversations.find(row => row.id === selectedId)
  const selectedTeacher = useMemo(() => teachers.find(row => row.id === selected?.teacher_id), [teachers, selected?.teacher_id])

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !selectedId || !ownerId || sending) return
    setSending(true)
    setError('')
    try {
      const { error: insertError } = await supabase.from('teacher_support_messages')
        .insert({ conversation_id: selectedId, sender_id: ownerId, body })
      if (insertError) throw insertError
      setDraft('')
      await loadMessages()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the reply.')
    } finally {
      setSending(false)
    }
  }

  return <main className="main">
    <header className="topbar"><div><p className="eyebrow">PLATFORM ADMINISTRATION</p><h1>Teacher Support</h1></div></header>
    <section className="welcome"><div><p className="eyebrow">SUPPORT INBOX</p><h2>Help teachers through chat.</h2><p className="muted">Teacher messages from the in-app support chat appear here.</p></div><MessageCircle size={34}/></section>
    {error && <div className="admin-message admin-message-error" role="alert">{error}</div>}
    <section className="panel" style={{display:'grid',gridTemplateColumns:'minmax(220px, 0.8fr) minmax(320px, 1.6fr)',gap:20}}>
      <div>
        <h3>Teacher conversations</h3>
        {loading ? <p className="muted">Loading conversations...</p> : conversations.length===0 ? <p className="muted">No teacher messages yet. Their first support message will start a conversation here.</p> :
          conversations.map(row => <button key={row.id} className="secondary" type="button" onClick={()=>setSelectedId(row.id)} style={{width:'100%',justifyContent:'flex-start',marginBottom:8,background:selectedId===row.id?'#eef2ff':undefined}}>
            <UserRound size={16}/>{teachers.find(t=>t.id===row.teacher_id)?.full_name || 'Teacher'}<small>{new Date(row.created_at).toLocaleDateString()}</small>
          </button>)}
      </div>
      <div>
        <h3>{selectedTeacher?.full_name || (selected ? 'Teacher conversation' : 'Select a conversation')}</h3>
        {selected && <>
          <div style={{display:'grid',gap:12,minHeight:260,maxHeight:'52vh',overflowY:'auto',padding:'12px 0'}}>
            {messages.map(message => <article key={message.id} style={{justifySelf:message.sender_id===ownerId?'end':'start',maxWidth:'85%',padding:12,borderRadius:12,background:message.sender_id===ownerId?'#eef2ff':'#f1f5f9'}}>
              <small>{message.sender_id===ownerId?'You':'Teacher'} · {new Date(message.created_at).toLocaleString()}</small><p style={{margin:'6px 0 0',whiteSpace:'pre-wrap'}}>{message.body}</p>
            </article>)}
          </div>
          <form onSubmit={sendReply} style={{display:'flex',gap:8,marginTop:14}}>
            <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={3} maxLength={5000} placeholder="Write a reply to the teacher..." required style={{flex:1}} aria-label="Your reply to the teacher" />
            <button className="primary" type="submit" disabled={sending||!ownerId}><Send size={16}/>{sending?'Sending...':'Reply'}</button>
          </form>
        </>}
      </div>
    </section>
  </main>
}
