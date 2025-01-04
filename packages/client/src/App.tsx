import { Layout } from 'antd'
import { BrowserRouter as Router } from 'react-router-dom'
import AppRoutes from './routes'
import './App.css'

const { Header, Content, Footer } = Layout

function App() {
  return (
    <Router>
      <Layout className="layout">
        {/* <Header>
          <div className="logo">和联胜 阅后即焚</div>
        </Header> */}
        <Content style={{  }}>
          <AppRoutes />
        </Content>
        {/* <Footer style={{ textAlign: 'center' }}>和联胜 阅后即焚 ©{new Date().getFullYear()}</Footer> */}
      </Layout>
    </Router>
  )
}

export default App 