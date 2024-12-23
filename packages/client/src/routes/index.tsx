import { Routes, Route } from 'react-router-dom'
import Chat from '../pages/Chat'
import Login from '../pages/Login'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/chat" element={<Chat />} />
      <Route path="/" element={<Login />} />
    </Routes>
  )
}

export default AppRoutes 