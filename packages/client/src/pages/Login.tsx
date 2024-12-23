import React from 'react'
import { Card, Form, Input, Button, message } from 'antd'
import { useNavigate } from 'react-router-dom'

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [form] = Form.useForm()

  const onFinish = (values: { username: string }) => {
    if (!values.username.trim()) {
      message.error('请输入用户名')
      return
    }
    
    // 保存用户信息到 localStorage
    localStorage.setItem('user', JSON.stringify({
      username: values.username,
      id: Date.now().toString() // 简单使用时间戳作为用户ID
    }))
    
    message.success('登录成功')
    navigate('/chat')
  }

  return (
    <Card title="登录" style={{ maxWidth: 400, margin: '100px auto' }}>
      <Form 
        form={form}
        layout="vertical"
        onFinish={onFinish}
      >
        <Form.Item 
          label="用户名" 
          name="username"
          rules={[{ required: true, message: '请输入用户名' }]}
        >
          <Input placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            进入聊天
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default Login 