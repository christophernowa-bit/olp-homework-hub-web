import { BookOpen, Plus, Search, Users } from 'lucide-react'

export default function Classes() {
  return (
    <>
      <header className="topbar">
        <div>
          <p className="eyebrow">TEACHER WORKSPACE</p>
          <h1>Classes</h1>
        </div>
        <button className="avatar" type="button">CN</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">CLASS MANAGEMENT</p>
          <h2>Organise your learners.</h2>
          <p className="muted">
            Create classes and keep your learners and exams organised.
          </p>
        </div>

        <button className="primary" type="button">
          <Plus size={18} />
          Create class
        </button>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Your classes</h3>
              <p>Your saved classes will appear here.</p>
            </div>

            <button className="icon-button" type="button">
              <Search size={20} />
            </button>
          </div>

          <div className="empty-state">
            <Users size={34} />
            <strong>No classes yet</strong>
            <p>Create your first class to get started.</p>
          </div>
        </div>

        <div className="panel quick">
          <h3>Class tools</h3>

          <button type="button">
            <Plus size={17} />
            <span>
              <strong>Create a class</strong>
              <small>Add a new class</small>
            </span>
          </button>

          <button type="button">
            <BookOpen size={17} />
            <span>
              <strong>Manage subjects</strong>
              <small>Organise subjects for your classes</small>
            </span>
          </button>
        </div>
      </section>
    </>
  )
}
