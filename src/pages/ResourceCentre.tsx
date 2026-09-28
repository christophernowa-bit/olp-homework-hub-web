import {
  BookOpen,
  FileText,
  FolderOpen,
  Plus,
  Search,
} from 'lucide-react'

export default function ResourceCentre() {
  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">TEACHER WORKSPACE</p>
          <h1>Resource Centre</h1>
        </div>
        <button className="avatar" type="button">CN</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">TEACHING RESOURCES</p>
          <h2>Your teaching materials in one place.</h2>
          <p className="muted">
            Organise worksheets, notes, revision materials and other classroom resources.
          </p>
        </div>

        <button className="primary" type="button">
          <Plus size={18} />
          Add resource
        </button>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Your resources</h3>
              <p>Saved teaching materials will appear here.</p>
            </div>

            <button className="icon-button" type="button">
              <Search size={20} />
            </button>
          </div>

          <div className="empty-state">
            <FolderOpen size={34} />
            <strong>No resources yet</strong>
            <p>Add your first teaching resource to get started.</p>
          </div>
        </div>

        <div className="panel quick">
          <h3>Resource tools</h3>

          <button type="button">
            <FileText size={17} />
            <span>
              <strong>Add a resource</strong>
              <small>Upload teaching materials</small>
            </span>
          </button>

          <button type="button">
            <BookOpen size={17} />
            <span>
              <strong>Browse resources</strong>
              <small>Explore your resource library</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}
