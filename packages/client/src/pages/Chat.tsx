import React, { useState, useEffect } from 'react'
import { Layout, Button, Input, List, Avatar, Badge } from 'antd'
import { useNavigate } from 'react-router-dom'
import { SendOutlined, UserOutlined } from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import styles from './Chat.module.css'

const { Header, Sider, Content } = Layout

interface ChatUser {
  id: string
  username: string
  socketId: string
}

interface Message {
  id: string
  content: string
  from: ChatUser
  to: ChatUser
  timestamp: Date
}

const Chat: React.FC = () => {
  const navigate = useNavigate()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [message, setMessage] = useState('')
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    // 连接 Socket.IO 服务器
    const newSocket = io('http://localhost:3000', {
      reconnection: false // 禁用自动重连
    })
    
    // 发送登录信息
    newSocket.emit('user:login', {
      id: currentUser.id,
      username: currentUser.username
    })

    // 监听在线用户列表更新
    newSocket.on('users:online', (users: ChatUser[]) => {
      setOnlineUsers(users.filter(user => user.socketId !== newSocket.id))
    })

    // 接收新消息
    newSocket.on('message:receive', (message: Message) => {
      setMessages(prev => [...prev, message])
    })

    setSocket(newSocket)

    // 清理函数
    return () => {
      newSocket.disconnect()
    }
  }, []) // 移除 currentUser 依赖

  // 选择聊天对象时加载历史消息
  useEffect(() => {
    if (selectedUser && socket) {
      socket.emit('message:history', {
        userId1: currentUser.id,
        userId2: selectedUser.id
      })

      socket.on('message:history', (history: Message[]) => {
        setMessages(history)
      })
    }
  }, [selectedUser, socket])

  const handleLogout = () => {
    socket?.close()
    localStorage.removeItem('user')
    navigate('/login')
  }

  const handleSendMessage = () => {
    if (!message.trim() || !selectedUser || !socket) return

    const newMessage = {
      from: {
        id: currentUser.id,
        username: currentUser.username,
        socketId: socket.id
      },
      to: selectedUser,
      content: message
    }

    console.log('newMessage', newMessage)
    socket.emit('message:send', newMessage)
    setMessage('')
  }

  const renderMessage = (msg: Message) => {
    const isSelf = msg.from.id === currentUser.id
    return (
      <div
        key={msg.id}
        className={`${styles.messageItem} ${
          isSelf ? styles.messageSelf : ''
        }`}
      >
        <Avatar icon={<UserOutlined />} />
        <div className={styles.messageContent}>
          <div className={styles.messageUser}>
            {isSelf ? '我' : msg.from.username}
          </div>
          <div className={styles.messageText}>{msg.content}</div>
        </div>
      </div>
    )
  }

  return (
    <Layout className={styles.chatLayout}>
      <Header className={styles.header}>
        <div className={styles.userInfo}>
          <Avatar icon={<UserOutlined />} />
          <span className={styles.username}>{currentUser.username}</span>
        </div>
        <Button onClick={handleLogout}>退出</Button>
      </Header>
      <Layout>
        <Sider width={300} className={styles.sider}>
          <List
            className={styles.chatList}
            itemLayout="horizontal"
            dataSource={onlineUsers}
            renderItem={(item) => (
              <List.Item
                className={styles.chatItem}
                onClick={() => setSelectedUser(item)}
              >
                <List.Item.Meta
                  avatar={<Avatar icon={<UserOutlined />} />}
                  title={item.username}
                />
              </List.Item>
            )}
          />
        </Sider>
        <Content className={styles.content}>
          {selectedUser ? (
            <>
              <div className={styles.chatHeader}>
                {selectedUser.username}
              </div>
              <div className={styles.messageArea}>
                {messages.map(renderMessage)}
              </div>
              <div className={styles.inputArea}>
                <Input.TextArea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="请输入消息"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  onPressEnter={(e) => {
                    if (!e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                />
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSendMessage}
                >
                  发送
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.noChat}>
              请选择一个聊天
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}

export default Chat 