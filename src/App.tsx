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

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
