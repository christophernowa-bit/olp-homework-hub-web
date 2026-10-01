import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Exams from './pages/Exams'
import Classes from './pages/Classes'
import Settings from './pages/Settings'
import AppLayout from './components/AppLayout'
import Discussions from './pages/Discussions'
import ResourceCentre from './pages/ResourceCentre'
import Login from './pages/Login'
import ProtectedRoute from './components/ProtectedRoute'
import RoleRoute from './components/RoleRoute'
import OwnerDashboard from './pages/OwnerDashboard'
import UsersRoles from './pages/UsersRoles'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/discussions" element={<Discussions />} />
          <Route path="/resources" element={<ResourceCentre />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route element={<RoleRoute allowedRoles={['platform_owner']} />}>
          <Route path="/owner" element={<OwnerDashboard />} />
          <Route path="/owner/users" element={<UsersRoles />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
from pathlib import Path

css = """
/* ========================================
   AUTHENTICATION — FINAL LOGIN / SIGNUP
   Append this block to src/styles.css
   ======================================== */

.login-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 0 0 24px;
  padding: 4px;
  border: 1px solid #dfe5ee;
  border-radius: 10px;
  background: #f8fafc;
}

.login-tabs button {
  min-height: 38px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: #64748b;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.login-tabs button.active {
  background: #ffffff;
  color: #111827;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}

.login-link-button {
  border: 0;
  background: transparent;
  color: #334155;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  text-align: center;
}

.login-link-button:hover,
.login-footnote button:hover {
  text-decoration: underline;
}

.login-footnote {
  margin: 22px 0 0;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.login-footnote button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #111827;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.login-message-success {
  background: #f4fbf6;
  color: #166534;
}

.login-role-choice {
  margin: 0;
  padding: 0;
  border: 0;
}

.login-role-choice legend {
  margin-bottom: 8px;
  color: #172033;
  font-size: 14px;
  font-weight: 700;
}

.login-role-choice > label {
  display: grid;
  grid-template-columns: auto auto 1fr;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 11px 12px;
  border: 1px solid #d8e0ea;
  border-radius: 10px;
  background: #ffffff;
  cursor: pointer;
}

.login-role-choice > label.selected {
  border-color: #64748b;
  background: #f8fafc;
}

.login-role-choice input {
  margin: 0;
}

.login-role-choice span {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.login-role-choice strong {
  font-size: 13px;
}

.login-role-choice small {
  color: #64748b;
  font-size: 11px;
  font-weight: 500;
}

.sidebar-account {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: auto;
  padding-top: 18px;
}

.sidebar-account > span {
  color: #8d98a8;
  font-size: 11px;
}

.sidebar-logout {
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px;
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 9px;
  background: rgba(255,255,255,0.06);
  color: inherit;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.sidebar-logout:hover {
  background: rgba(255,255,255,0.1);
}

.sidebar-logout:disabled {
  opacity: 0.6;
  cursor: wait;
}

@media (max-width: 600px) {
  .login-tabs {
    margin-bottom: 20px;
  }
}
"""

Path("/mnt/data/auth-styles-append.css").write_text(css, encoding="utf-8")
print("Created /mnt/data/auth-styles-append.css")
