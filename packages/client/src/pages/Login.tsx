import React from 'react'
import { Card, Form, Input, Button } from 'antd'

const Login: React.FC = () => {
  return (
    <Card title="登录" style={{ maxWidth: 400, margin: '100px auto' }}>
      <Form layout="vertical">
        <Form.Item label="用户名" name="username">
          <Input />
        </Form.Item>
        <Form.Item label="密码" name="password">
          <Input.Password />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            登录
          </Button>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default Login 