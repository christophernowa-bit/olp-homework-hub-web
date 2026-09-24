import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BookOpen, ClipboardList, FilePlus2, LayoutDashboard, Menu, Settings, Users, X } from 'lucide-react'
import './styles.css'

const nav = [
  {label:'Dashboard', icon:LayoutDashboard},
  {label:'Exams', icon:ClipboardList},
  {label:'Question Bank', icon:BookOpen},
  {label:'Classes', icon:Users},
]

function App(){
  const [open,setOpen]=useState(false)
  const [active,setActive]=useState('Dashboard')
  return <div className="app">
    <aside className={open?'sidebar open':'sidebar'}>
      <div className="brand"><div className="brand-mark">OLP</div><div><strong>Homework Hub</strong><span>Teacher workspace</span></div><button className="close" onClick={()=>setOpen(false)}><X size={20}/></button></div>
      <nav>{nav.map(({label,icon:Icon})=><button key={label} className={active===label?'nav-item active':'nav-item'} onClick={()=>{setActive(label);setOpen(false)}}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <div className="sidebar-bottom"><button className="nav-item"><Settings size={19}/><span>Settings</span></button><div className="user"><div className="avatar">T</div><div><strong>Teacher</strong><span>Workspace</span></div></div></div>
    </aside>
    {open && <div className="scrim" onClick={()=>setOpen(false)}/>} 
    <main className="main">
      <header><button className="menu" onClick={()=>setOpen(true)}><Menu/></button><div><span className="eyebrow">Teacher workspace</span><h1>{active}</h1></div><div className="header-actions"><button className="secondary"><Settings size={17}/> Settings</button><button className="primary"><FilePlus2 size={17}/> Create exam</button></div></header>
      <section className="welcome"><div><span className="eyebrow">OLP Homework Hub</span><h2>Build better practice, one assessment at a time.</h2><p>Prepare structured Cambridge-style practice papers, organise classes and keep teacher workspaces separate.</p></div><button className="primary large"><FilePlus2 size={18}/> Start an exam</button></section>
      <section className="stats"><div><span>Draft exams</span><strong>0</strong><small>Ready to continue</small></div><div><span>Published exams</span><strong>0</strong><small>Shared with learners</small></div><div><span>Question bank</span><strong>0</strong><small>Reusable questions</small></div><div><span>Classes</span><strong>0</strong><small>Teacher groups</small></div></section>
      <section className="grid"><div className="card"><div className="card-head"><div><h3>Recent exams</h3><p>Your latest assessment work will appear here.</p></div><button className="text-btn">View all</button></div><div className="empty"><ClipboardList size={30}/><strong>No exams yet</strong><span>Create your first exam to begin building the hub.</span><button className="primary">Create exam</button></div></div><div className="card"><div className="card-head"><div><h3>Quick start</h3><p>Core workflows for the new foundation.</p></div></div><div className="quick"><button><FilePlus2/><div><strong>Create an exam</strong><span>Start from a blank assessment or imported paper.</span></div></button><button><BookOpen/><div><strong>Build question bank</strong><span>Keep reusable questions organised by subject.</span></div></button><button><Users/><div><strong>Set up classes</strong><span>Prepare clean teacher and learner groupings.</span></div></button></div></div></section>
      <footer>OLP Homework Hub <span>•</span> Frontend foundation v0.1.0</footer>
    </main>
  </div>
}
createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)
