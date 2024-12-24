import React, { useState, useEffect, useRef } from 'react'
import { Layout, Button, Input, List, Avatar } from 'antd'
import { useNavigate } from 'react-router-dom'
import { SendOutlined } from '@ant-design/icons'
import { io, Socket } from 'socket.io-client'
import styles from './index.module.scss'

const { Header, Sider, Content } = Layout

interface ChatUser {
  id: string
  username: string
  socketId: string
  isGroup?: boolean
}

interface Message {
  id: string
  content: string
  from: ChatUser
  to: ChatUser
  timestamp: Date
  isGroupMessage?: boolean
}

// 获取头像显示文字
const getAvatarText = (username: string): string => {
  if (!username) return '?'
  const firstChar = username.charAt(0)
  // 如果是英文，返回大写首字母
  if (/[a-zA-Z]/.test(firstChar)) {
    return firstChar.toUpperCase()
  }
  // 如果是中文或其他字符，返回第一个字
  return firstChar
}

const Chat: React.FC = () => {
  const navigate = useNavigate()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [message, setMessage] = useState('')
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<ChatUser[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const messageEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    // 连接 Socket.IO 服务器
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '/'
    console.log('SOCKET_URL', import.meta.env.VITE_SOCKET_URL, SOCKET_URL)
    const newSocket = io('http://124.221.97.100:8090', {
      reconnection: false
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

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages])

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
    const isGroupMessage = msg.isGroupMessage
    const messageTime = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    
    return (
      <div
        key={msg.id}
        className={`${styles.messageItem} ${
          isSelf ? styles.messageSelf : ''
        }`}
      >
        <Avatar 
          className={styles.avatar}
          size={40}
          style={{ 
            backgroundColor: isSelf ? '#1d9bf0' : '#f0f0f0',
            color: isSelf ? '#fff' : '#666'
          }}
        >
          {getAvatarText(msg.from.username)}
        </Avatar>
        <div className={styles.messageContent}>
          <div className={styles.messageUser}>
            {isGroupMessage ? (
              <span>{isSelf ? '我' : msg.from.username}</span>
            ) : (
              isSelf ? '我' : msg.from.username
            )}
            <span className={styles.messageTime}>{messageTime}</span>
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
          <Avatar style={{ backgroundColor: '#1d9bf0', color: '#fff' }}>
            {getAvatarText(currentUser.username)}
          </Avatar>
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
                  avatar={
                    <Avatar style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
                      {getAvatarText(item.username)}
                    </Avatar>
                  }
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
                <div ref={messageEndRef} />
              </div>
              <div className={styles.inputArea}>
                <Input.TextArea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="请输入消息"
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  onPressEnter={(e) => {
                    if (e.nativeEvent.isComposing) return;
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