import { MessageCircle, Plus, Search, Users } from 'lucide-react'

export default function Discussions() {
  return (
    <main className="main">
      <header className="topbar">
        <div>
          <p className="eyebrow">TEACHER WORKSPACE</p>
          <h1>Discussions</h1>
        </div>
        <button className="avatar" type="button">CN</button>
      </header>

      <section className="welcome">
        <div>
          <p className="eyebrow">COMMUNITY</p>
          <h2>Connect and collaborate.</h2>
          <p className="muted">
            Share ideas, ask questions and discuss teaching with your community.
          </p>
        </div>

        <button className="primary" type="button">
          <Plus size={18} />
          Start discussion
        </button>
      </section>

      <section className="content-grid">
        <div className="panel">
          <div className="panel-heading">
            <div>
              <h3>Recent discussions</h3>
              <p>Conversations will appear here.</p>
            </div>

            <button className="icon-button" type="button">
              <Search size={20} />
            </button>
          </div>

          <div className="empty-state">
            <MessageCircle size={34} />
            <strong>No discussions yet</strong>
            <p>Start the first conversation with your community.</p>
          </div>
        </div>

        <div className="panel quick">
          <h3>Discussion tools</h3>

          <button type="button">
            <Plus size={17} />
            <span>
              <strong>Start a discussion</strong>
              <small>Ask a question or share an idea</small>
            </span>
          </button>

          <button type="button">
            <Users size={17} />
            <span>
              <strong>Community</strong>
              <small>Connect with other educators</small>
            </span>
          </button>
        </div>
      </section>
    </main>
  )
}
