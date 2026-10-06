import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  LibraryBig,
  MessageCircle,
  School,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

type SessionState = 'checking' | 'guest' | 'signed-in'

const features = [
  { icon: School, title: 'Classes', text: 'Keep classes, subjects and learning spaces organised.' },
  { icon: ClipboardCheck, title: 'Assignments', text: 'Create, share and complete classwork from one workspace.' },
  { icon: BookOpen, title: 'Exams', text: 'Prepare and complete structured assessments online.' },
  { icon: LibraryBig, title: 'Resource Centre', text: 'Keep useful learning materials easy to find and revisit.' },
  { icon: MessageCircle, title: 'Discussions', text: 'Continue focused classroom conversations beyond the lesson.' },
]

export default function Landing() {
  const [sessionState, setSessionState] = useState<SessionState>('checking')

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (active) setSessionState(data.session ? 'signed-in' : 'guest')
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setSessionState(session ? 'signed-in' : 'guest')
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  if (sessionState === 'checking') {
    return (
      <main className="landing-loading" aria-live="polite">
        <div className="landing-logo">OLP</div>
        <p>Opening OLP Homework Hub…</p>
      </main>
    )
  }

  if (sessionState === 'signed-in') return <Navigate to="/dashboard" replace />

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" to="/" aria-label="OLP Homework Hub home">
          <span className="landing-logo">OLP</span>
          <span><strong>OLP Homework Hub</strong><small>Learn. Practise. Progress.</small></span>
        </Link>
        <nav className="landing-nav-links" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#teachers-students">Who it helps</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <div className="landing-nav-actions">
          <Link className="landing-button landing-button-ghost" to="/login">Sign in</Link>
          <Link className="landing-button landing-button-primary" to="/login?view=signup">Create account</Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="landing-kicker"><Sparkles size={16} /> One learning space for school and home</div>
          <h1>Learning doesn’t stop when the lesson ends.</h1>
          <p className="landing-hero-lead">OLP Homework Hub gives teachers one place to organise learning and gives students a clear, simple space to access their work.</p>
          <div className="landing-hero-actions">
            <Link className="landing-button landing-button-primary landing-button-large" to="/login?view=signup">Get started <ArrowRight size={18} /></Link>
            <Link className="landing-button landing-button-secondary landing-button-large" to="/login">Sign in</Link>
          </div>
          <div className="landing-trust-row">
            <span><CheckCircle2 size={17} /> Teacher-friendly</span>
            <span><CheckCircle2 size={17} /> Student-focused</span>
            <span><CheckCircle2 size={17} /> Built for everyday learning</span>
          </div>
        </div>

        <div className="landing-hero-panel" aria-label="OLP Homework Hub overview">
          <div className="landing-panel-top">
            <div><span className="landing-panel-dot" /><span className="landing-panel-dot" /><span className="landing-panel-dot" /></div>
            <span>OLP Workspace</span>
          </div>
          <div className="landing-panel-body">
            <div className="landing-mini-sidebar">
              <span className="active"><School size={17} /> Classes</span>
              <span><ClipboardCheck size={17} /> Assignments</span>
              <span><BookOpen size={17} /> Exams</span>
              <span><LibraryBig size={17} /> Resources</span>
              <span><MessageCircle size={17} /> Discussions</span>
            </div>
            <div className="landing-mini-content">
              <p className="landing-mini-eyebrow">YOUR LEARNING SPACE</p>
              <h2>Everything where you expect it.</h2>
              <div className="landing-mini-cards">
                <article><span>Assignments</span><strong>Stay on track</strong><small>Classwork in one place</small></article>
                <article><span>Resources</span><strong>Learn anywhere</strong><small>Materials ready when needed</small></article>
              </div>
              <div className="landing-mini-progress"><span /><span /><span /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="features">
        <div className="landing-section-heading">
          <p className="landing-kicker-text">THE OLP WORKSPACE</p>
          <h2>The essentials for connected learning.</h2>
          <p>Move from class organisation to practice and discussion without scattering learning across different places.</p>
        </div>
        <div className="landing-feature-grid">
          {features.map(({ icon: Icon, title, text }) => (
            <article className="landing-feature-card" key={title}>
              <span className="landing-feature-icon"><Icon size={22} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-audience" id="teachers-students">
        <article className="landing-audience-card landing-teacher-card">
          <span className="landing-audience-icon"><UsersRound size={25} /></span>
          <p className="landing-kicker-text">FOR TEACHERS</p>
          <h2>Organise learning with less friction.</h2>
          <p>Create classes, prepare assignments and assessments, share resources and guide focused classroom discussions from one workspace.</p>
          <Link to="/login?view=signup">Create a teacher account <ArrowRight size={17} /></Link>
        </article>
        <article className="landing-audience-card landing-student-card">
          <span className="landing-audience-icon"><GraduationCap size={25} /></span>
          <p className="landing-kicker-text">FOR STUDENTS</p>
          <h2>Know what to learn next.</h2>
          <p>Access classwork, complete assignments, use learning resources, take assessments and join academic discussions in one clear space.</p>
          <Link to="/login?view=signup">Create a student account <ArrowRight size={17} /></Link>
        </article>
      </section>

      <section className="landing-section landing-how" id="how-it-works">
        <div className="landing-section-heading">
          <p className="landing-kicker-text">HOW IT WORKS</p>
          <h2>Simple enough to become part of the school day.</h2>
        </div>
        <div className="landing-steps">
          <article><span>01</span><h3>Create your account</h3><p>Join OLP as a teacher or student.</p></article>
          <article><span>02</span><h3>Connect with your class</h3><p>Keep learning organised around the right classes and subjects.</p></article>
          <article><span>03</span><h3>Learn and keep progressing</h3><p>Use assignments, exams, resources and discussions as part of everyday learning.</p></article>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="landing-kicker-text">OLP HOMEWORK HUB</p>
          <h2>Ready to bring learning together?</h2>
          <p>Start with one account and one clear place for the work that matters.</p>
        </div>
        <div className="landing-cta-actions">
          <Link className="landing-button landing-button-light landing-button-large" to="/login?view=signup">Create account</Link>
          <Link className="landing-button landing-button-outline-light landing-button-large" to="/login">Sign in</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-brand">
          <span className="landing-logo">OLP</span>
          <span><strong>OLP Homework Hub</strong><small>Learn. Practise. Progress.</small></span>
        </div>
        <p>© {new Date().getFullYear()} OLP Homework Hub. Supporting connected learning.</p>
      </footer>
    </main>
  )
}
