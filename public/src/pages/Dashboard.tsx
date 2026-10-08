import {
  FileText,
  Plus,
  Search,
} from 'lucide-react'

export default function Dashboard() {
  return (
    
      

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Teacher workspace</p>
            <h1>Dashboard</h1>
          </div>
          <button className="avatar" type="button">CN</button>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow">Welcome back</p>
            <h2>Build better practice papers.</h2>
            <p className="muted">
              Create, edit and organise your exams from one place.
            </p>
          </div>

          <button className="primary" type="button">
            <Plus size={18} />
            Create exam
          </button>
        </section>

        <section className="stats">
          <div className="card">
            <span>Total exams</span>
            <strong>0</strong>
            <small>Ready for your first exam</small>
          </div>

          <div className="card">
            <span>Classes</span>
            <strong>0</strong>
            <small>Classes will appear here</small>
          </div>

          <div className="card">
            <span>Drafts</span>
            <strong>0</strong>
            <small>No drafts yet</small>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>Recent exams</h3>
                <p>New exams will appear here.</p>
              </div>

              <button className="icon-button" type="button">
                <Search size={18} />
              </button>
            </div>

            <div className="empty-state">
              <FileText size={32} />
              <strong>No exams yet</strong>
              <p>Create your first exam to get started.</p>
            </div>
          </div>

          <div className="panel quick">
            <h3>Quick start</h3>

            <button type="button">
              <Plus size={17} />
              <span>
                <strong>Create an exam</strong>
                <small>Start from scratch</small>
              </span>
            </button>

            <button type="button">
              <FileText size={17} />
              <span>
                <strong>Import a paper</strong>
                <small>Add an existing paper later</small>
              </span>
            </button>
          </div>
        </section>
      </main>
      )
}
