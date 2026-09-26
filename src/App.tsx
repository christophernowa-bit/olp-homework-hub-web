import { Navigate, Route, Routes } from 'react-router-dom'
import Dashboard from './pages/Dashboard'


function Exams() {
  return <h1>Exams</h1>
}

function Classes() {
  return <h1>Classes</h1>
}

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
