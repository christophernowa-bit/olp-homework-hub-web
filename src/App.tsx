import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Exams from './pages/Exams'
import Classes from './pages/Classes'




function Settings() {
  return <h1>Settings</h1>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/exams" element={<Exams />} />
      <Route path="/classes" element={<Classes />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
