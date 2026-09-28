import { useState } from 'react'
import { Lock, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage(error.message)
      setLoading(false)
      return
    }

    window.location.href = '/'
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">OLP</div>

        <p className="eyebrow">OLP HOMEWORK HUB</p>
        <h1>Welcome back</h1>
        <p className="muted">
          Sign in to your teaching workspace.
        </p>

        <form onSubmit={handleLogin} className="login-form">
          <label>
            Email address
            <div className="login-input">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </label>

          <label>
            Password
            <div className="login-input">
              <Lock size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </label>

          {message && <p className="login-message">{message}</p>}

          <button className="primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
