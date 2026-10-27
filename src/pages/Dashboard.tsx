import { ClipboardList, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <main className="main">
      <header className="topbar">
        <div><p className="eyebrow">Teacher workspace</p><h1>Dashboard</h1></div>
        <button className="avatar" type="button">CN</button>
      </header>
      <section className="welcome">
        <div><p className="eyebrow">Welcome back</p><h2>Keep classwork moving.</h2><p className="muted">Create and manage assignments for your classes.</p></div>
        <Link className="primary" to="/assignments"><Plus size={18} /> Go to assignments</Link>
      </section>
      <section className="panel quick">
        <h3>Assignments</h3>
        <p>Set work, collect student responses and review submissions in one place.</p>
        <Link className="secondary" to="/assignments"><ClipboardList size={17} /> Open assignments</Link>
      </section>
    </main>
  )
}
