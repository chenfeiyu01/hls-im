import { Routes, Route } from 'react-router-dom'
import Chat from '../pages/Chat'
import Login from '../pages/Login'
import PrivateRoute from '../components/PrivateRoute'

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route 
        path="/chat" 
        element={
          <PrivateRoute>
            <Chat />
          </PrivateRoute>
        } 
      />
      <Route path="/" element={<Login />} />
    </Routes>
  )
}

export default AppRoutes 