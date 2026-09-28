import {
  FileText,
  Plus,
  Search,
  Upload,
} from 'lucide-react'

export default function Exams() {
  return (
    <div className="app-shell">
     
      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">Teacher workspace</p>
            <h1>Exams</h1>
          </div>
          <button className="avatar" type="button">CN</button>
        </header>

        <section className="welcome">
          <div>
            <p className="eyebrow">Exam library</p>
            <h2>Your practice papers.</h2>
            <p className="muted">
              Create, import, edit and organise exams from one place.
            </p>
          </div>

          <button className="primary" type="button">
            <Plus size={18} />
            Create exam
          </button>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-heading">
              <div>
                <h3>All exams</h3>
                <p>Your saved exams will appear here.</p>
              </div>

              <button className="icon-button" type="button">
                <Search size={18} />
              </button>
            </div>

            <div className="empty-state">
              <FileText size={32} />
              <strong>No exams yet</strong>
              <p>Create or import your first practice paper.</p>
            </div>
          </div>

          <div className="panel quick">
            <h3>Exam tools</h3>

            <button type="button">
              <Plus size={17} />
              <span>
                <strong>Create an exam</strong>
                <small>Build a new paper from scratch</small>
              </span>
            </button>

            <button type="button">
              <Upload size={17} />
              <span>
                <strong>Import a paper</strong>
                <small>Upload an existing exam paper</small>
              </span>
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
