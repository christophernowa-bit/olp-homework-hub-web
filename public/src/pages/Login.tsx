import { useEffect, useState } from 'react'
import { Eye, EyeOff, GraduationCap, Lock, Mail, UserRound } from 'lucide-react'
import { supabase } from '../lib/supabase'

type ViewMode = 'signin' | 'signup' | 'forgot' | 'recovery'
type SignupRole = 'teacher' | 'student'

export default function Login() {
  const [view, setView] = useState<ViewMode>(() => new URLSearchParams(window.location.search).get('view') === 'signup' ? 'signup' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [signupRole, setSignupRole] = useState<SignupRole>('student')
  const [forgotEmail, setForgotEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showSignupPassword, setShowSignupPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setView('recovery')
        setMessage('')
        setSuccess('')
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  function changeView(next: ViewMode) {
    setView(next)
    setMessage('')
    setSuccess('')
    setLoading(false)
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setSuccess('')
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
      if (error) throw error
      window.location.href = '/dashboard'
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to sign in.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setSuccess('')
    try {
      const name = fullName.trim()
      const cleanEmail = signupEmail.trim().toLowerCase()
      if (!name) throw new Error('Full name is required.')
      if (!cleanEmail) throw new Error('Email address is required.')
      if (signupPassword.length < 8) throw new Error('Password must contain at least 8 characters.')
      if (signupPassword !== confirmPassword) throw new Error('Passwords do not match.')

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/public-signup`,
        {
          method: 'POST',
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            full_name: name,
            email: cleanEmail,
            password: signupPassword,
            role: signupRole,
          }),
        },
      )

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Unable to create account.')

      setSuccess(result.message || 'Account created successfully. You can now sign in.')
      setEmail(cleanEmail)
      setFullName('')
      setSignupEmail('')
      setSignupPassword('')
      setConfirmPassword('')
      setSignupRole('student')
      setView('signin')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to create account.')
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setSuccess('')
    try {
      const cleanEmail = forgotEmail.trim().toLowerCase()
      if (!cleanEmail) throw new Error('Enter your email address.')

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${window.location.origin}/login`,
      })
      if (error) throw error

      setSuccess('Password reset email sent. Open the link in your email to choose a new password.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to send reset email.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    setSuccess('')
    try {
      if (newPassword.length < 8) throw new Error('Password must contain at least 8 characters.')
      if (newPassword !== confirmNewPassword) throw new Error('Passwords do not match.')

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      await supabase.auth.signOut()
      setNewPassword('')
      setConfirmNewPassword('')
      setSuccess('Password updated successfully. Sign in with your new password.')
      setView('signin')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Unable to update password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark">OLP</div>
        <p className="eyebrow">OLP HOMEWORK HUB</p>

        {view === 'signin' && (
          <>
            <h1>Welcome back</h1>
            <p className="muted">Sign in to your OLP Homework Hub account.</p>

            <div className="login-tabs">
              <button type="button" className="active" onClick={() => changeView('signin')}>Sign in</button>
              <button type="button" onClick={() => changeView('signup')}>Create account</button>
            </div>

            <form onSubmit={handleLogin} className="login-form">
              <label>
                Email address
                <div className="login-input">
                  <Mail size={18} />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com" />
                </div>
              </label>

              <label>
                Password
                <div className="login-input">
                  <Lock size={18} />
                  <div className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Your password" /><button type="button" className="password-toggle" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </div>
              </label>

              {message && <p className="login-message">{message}</p>}
              {success && <p className="login-message login-message-success">{success}</p>}

              <button className="primary" type="submit" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>

              <button className="login-link-button" type="button" onClick={() => { setForgotEmail(email); changeView('forgot') }}>
                Forgot password?
              </button>
            </form>

            <p className="login-footnote">
              New Teacher or Student? <button type="button" onClick={() => changeView('signup')}>Create your account</button>
            </p>
          </>
        )}

        {view === 'signup' && (
          <>
            <h1>Create account</h1>
            <p className="muted">Teachers and Students can create their own OLP account.</p>

            <div className="login-tabs">
              <button type="button" onClick={() => changeView('signin')}>Sign in</button>
              <button type="button" className="active" onClick={() => changeView('signup')}>Create account</button>
            </div>

            <form onSubmit={handleSignup} className="login-form">
              <label>
                Full name
                <div className="login-input">
                  <UserRound size={18} />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required autoComplete="name" placeholder="Your full name" />
                </div>
              </label>

              <label>
                Email address
                <div className="login-input">
                  <Mail size={18} />
                  <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com" />
                </div>
              </label>

              <fieldset className="login-role-choice">
                <legend>Account type</legend>
                <label className={signupRole === 'student' ? 'selected' : ''}>
                  <input type="radio" name="signup-role" checked={signupRole === 'student'} onChange={() => setSignupRole('student')} />
                  <GraduationCap size={18} />
                  <span><strong>Student</strong><small>Join classes and access learning resources.</small></span>
                </label>
                <label className={signupRole === 'teacher' ? 'selected' : ''}>
                  <input type="radio" name="signup-role" checked={signupRole === 'teacher'} onChange={() => setSignupRole('teacher')} />
                  <UserRound size={18} />
                  <span><strong>Teacher</strong><small>Create classes and manage learning.</small></span>
                </label>
              </fieldset>

              <label>
                Password
                <div className="login-input">
                  <Lock size={18} />
                  <div className="password-field"><input type={showSignupPassword ? "text" : "password"} value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowSignupPassword((v) => !v)} aria-label={showSignupPassword ? "Hide password" : "Show password"}>{showSignupPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </div>
              </label>

              <label>
                Confirm password
                <div className="login-input">
                  <Lock size={18} />
                  <div className="password-field"><input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password" placeholder="Repeat your password" /><button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((v) => !v)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </div>
              </label>

              {message && <p className="login-message">{message}</p>}
              {success && <p className="login-message login-message-success">{success}</p>}

              <button className="primary" type="submit" disabled={loading}>
                {loading ? 'Creating account...' : 'Create account'}
              </button>

              <button className="login-link-button" type="button" onClick={() => changeView('signin')}>Back to sign in</button>
            </form>
          </>
        )}

        {view === 'forgot' && (
          <>
            <h1>Forgot password?</h1>
            <p className="muted">Enter your email address and we will send you a secure reset link.</p>

            <form onSubmit={handleForgotPassword} className="login-form">
              <label>
                Email address
                <div className="login-input">
                  <Mail size={18} />
                  <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} required autoComplete="email" placeholder="name@example.com" />
                </div>
              </label>

              {message && <p className="login-message">{message}</p>}
              {success && <p className="login-message login-message-success">{success}</p>}

              <button className="primary" type="submit" disabled={loading}>{loading ? 'Sending...' : 'Send reset link'}</button>
              <button className="login-link-button" type="button" onClick={() => changeView('signin')}>Back to sign in</button>
            </form>
          </>
        )}

        {view === 'recovery' && (
          <>
            <h1>Choose a new password</h1>
            <p className="muted">Enter and confirm your new OLP Homework Hub password.</p>

            <form onSubmit={handleRecovery} className="login-form">
              <label>
                New password
                <div className="login-input">
                  <Lock size={18} />
                  <div className="password-field"><input type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" /><button type="button" className="password-toggle" onClick={() => setShowNewPassword((v) => !v)} aria-label={showNewPassword ? "Hide password" : "Show password"}>{showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </div>
              </label>

              <label>
                Confirm new password
                <div className="login-input">
                  <Lock size={18} />
                  <div className="password-field"><input type={showConfirmNewPassword ? "text" : "password"} value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required minLength={8} autoComplete="new-password" /><button type="button" className="password-toggle" onClick={() => setShowConfirmNewPassword((v) => !v)} aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}>{showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div>
                </div>
              </label>

              {message && <p className="login-message">{message}</p>}

              <button className="primary" type="submit" disabled={loading}>{loading ? 'Saving...' : 'Save new password'}</button>
            </form>
          </>
        )}
      </section>
    </main>
  )
}
