import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Exams from './pages/Exams'
import Classes from './pages/Classes'
import Settings from './pages/Settings'
import AppLayout from './components/AppLayout'




export default function App() {
  return (
   <Routes>
  <Route element={<AppLayout />}>
    <Route path="/" element={<Dashboard />} />
    <Route path="/exams" element={<Exams />} />
    <Route path="/classes" element={<Classes />} />
    <Route path="/settings" element={<Settings />} />
  </Route>

  <Route path="*" element={<Navigate to="/" replace />} />
</Routes>

  )
}
