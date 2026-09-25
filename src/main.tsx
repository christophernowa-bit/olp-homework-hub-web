import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { FileText, LayoutDashboard, Plus, Search, Settings, Users } from 'lucide-react'
import './styles.css'

function App() {
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">OLP</div><div><strong>Homework Hub</strong><span>Teacher workspace</span></div></div>
      <nav className="nav"><a className="nav-item active" href="#"><LayoutDashboard size={18}/>Dashboard</a><a className="nav-item" href="#"><FileText size={18}/>Exams</a><a className="nav-item" href="#"><Users size={18}/>Classes</a><a className="nav-item" href="#"><Settings size={18}/>Settings</a></nav>
      <div className="sidebar-note"><strong>OLP Homework Hub</strong><p>A clean foundation for creating, editing and managing Cambridge-style practice work.</p></div>
    </aside>
    <main className="main"><header className="topbar"><div><p className="eyebrow">Teacher workspace</p><h1>Dashboard</h1></div><button className="profile">CN</button></header>
      <section className="welcome"><div><p className="eyebrow">Welcome back</p><h2>Build better practice papers.</h2><p className="muted">Create, edit and organise your exams from one place.</p></div><button className="primary"><Plus size={18}/>Create exam</button></section>
      <section className="stats"><div className="card"><span>Total exams</span><strong>0</strong><small>Ready for your first exam</small></div><div className="card"><span>Classes</span><strong>0</strong><small>Classes will appear here</small></div><div className="card"><span>Drafts</span><strong>0</strong><small>No drafts yet</small></div></section>
      <section className="content-grid"><div className="panel"><div className="panel-heading"><div><h3>Recent exams</h3><p>New exams will appear here.</p></div><button className="icon-button" aria-label="Search"><Search size={18}/></button></div><div className="empty-state"><FileText size={30}/><strong>No exams yet</strong><span>Create your first exam to get started.</span><button className="secondary">Create an exam</button></div></div>
      <div className="panel quick"><h3>Quick start</h3><button><Plus size={17}/><span><strong>Create an exam</strong><small>Start from scratch</small></span></button><button><FileText size={17}/><span><strong>Import a paper</strong><small>Add an existing paper later</small></span></button><button><Users size={17}/><span><strong>Set up classes</strong><small>Organise your teaching groups</small></span></button></div></section>
    </main></div>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
