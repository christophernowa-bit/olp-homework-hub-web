import { FormEvent, useCallback, useEffect, useState } from 'react'
import { MessageCircle, Send } from 'lucide-react'
import { supabase } from '../lib/supabase'

type ChatMessage = { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }

export default function TeacherSupport() {
  const [userId, setUserId] = useState('')
  const [conversationId, setConversationId] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const loadMessages = useCallback(async (id = conversationId) => {
    if (!id) return
    const { data, error: queryError } = await supabase.from('teacher_support_messages')
      .select('id, conversation_id, sender_id, body, created_at')
      .eq('conversation_id', id).order('created_at', { ascending: true })
    if (queryError) setError(queryError.message)
    else setMessages(data ?? [])
  }, [conversationId])

  useEffect(() => {
    let alive = true
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (alive) { setError('Please sign in again.'); setLoading(false) }; return }
      if (!alive) return
      setUserId(user.id)
      const { data, error: queryError } = await supabase.from('teacher_support_conversations')
        .select('id').eq('teacher_id', user.id).maybeSingle()
      if (!alive) return
      if (queryError) setError(queryError.message)
      if (data) setConversationId(data.id)
      setLoading(false)
    }
    void init()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!conversationId) return
    void loadMessages(conversationId)
    const timer = window.setInterval(() => void loadMessages(conversationId), 4000)
    return () => window.clearInterval(timer)
  }, [conversationId, loadMessages])

  async function ensureConversation() {
    if (conversationId) return conversationId
    const { data, error: insertError } = await supabase.from('teacher_support_conversations')
      .insert({ teacher_id: userId }).select('id').single()
    if (!insertError && data) { setConversationId(data.id); return data.id }
    const { data: existing } = await supabase.from('teacher_support_conversations')
      .select('id').eq('teacher_id', userId).maybeSingle()
    if (existing) { setConversationId(existing.id); return existing.id }
    throw insertError ?? new Error('Could not open the support chat.')
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = draft.trim()
    if (!body || sending || !userId) return
    setSending(true)
    setError('')
    try {
      const id = await ensureConversation()
      const { error: insertError } = await supabase.from('teacher_support_messages')
        .insert({ conversation_id: id, sender_id: userId, body })
      if (insertError) throw insertError
      setDraft('')
      await loadMessages(id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.')
    } finally {
      setSending(false)
    }
  }

  return <main className="main">
    <header className="topbar"><div><p className="eyebrow">TEACHER WORKSPACE</p><h1>Help & Support</h1></div></header>
    <section className="welcome"><div><p className="eyebrow">OLP HOMEWORK HUB</p><h2>How can we help?</h2><p className="muted">Send a message to the platform owner. Replies will appear here.</p></div><MessageCircle size={34} /></section>
    {error && <div className="admin-message admin-message-error" role="alert">{error}</div>}
    <section className="panel">
      <h3>Chat with the Platform Owner</h3>
      {loading ? <p className="muted">Loading your chat...</p> : <div style={{display:'grid',gap:12,minHeight:220,maxHeight:'55vh',overflowY:'auto',padding:'12px 0'}}>
        {messages.length === 0 ? <p className="muted">Ask a question or let us know if you need help getting started.</p> : messages.map(message => <article key={message.id} style={{justifySelf:message.sender_id===userId?'end':'start',maxWidth:'85%',padding:12,borderRadius:12,background:message.sender_id===userId?'#eef2ff':'#f1f5f9'}}>
          <small>{message.sender_id===userId?'You':'Platform Owner'} · {new Date(message.created_at).toLocaleString()}</small><p style={{margin:'6px 0 0',whiteSpace:'pre-wrap'}}>{message.body}</p>
        </article>)}
      </div>}
      <form onSubmit={sendMessage} style={{display:'flex',gap:8,marginTop:14}}>
        <textarea value={draft} onChange={e=>setDraft(e.target.value)} rows={3} maxLength={5000} placeholder="Write your message..." required style={{flex:1}} aria-label="Your message to the platform owner" />
        <button className="primary" type="submit" disabled={sending||loading||!userId}><Send size={16}/>{sending?'Sending...':'Send'}</button>
      </form>
    </section>
  </main>
}
