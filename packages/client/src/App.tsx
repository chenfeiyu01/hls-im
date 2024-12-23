import { Layout } from 'antd'
import { BrowserRouter as Router } from 'react-router-dom'
import AppRoutes from './routes'
import './App.css'

const { Header, Content, Footer } = Layout

function App() {
  return (
    <Router>
      <Layout className="layout">
        <Header>
          <div className="logo">IM App</div>
        </Header>
        <Content style={{ padding: '24px' }}>
          <AppRoutes />
        </Content>
        <Footer style={{ textAlign: 'center' }}>IM App ©{new Date().getFullYear()}</Footer>
      </Layout>
    </Router>
  )
}

export default App 