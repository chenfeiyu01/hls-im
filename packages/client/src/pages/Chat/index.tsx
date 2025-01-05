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

interface MessageHistoryResponse {
  messages: Message[];
  hasMore: boolean;
  total: number;
}

// 添加未读消息计数接口
interface ChatUserWithUnread extends ChatUser {
  unreadCount?: number;
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

// 在文件顶部添加一个检测移动设备的函数
const isMobile = () => {
  return window.innerWidth <= 768
}

const Chat: React.FC = () => {
  const navigate = useNavigate()
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}')
  const [message, setMessage] = useState('')
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null)
  const [onlineUsers, setOnlineUsers] = useState<ChatUserWithUnread[]>([])
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const messageEndRef = useRef<HTMLDivElement>(null)
  // 添加一个状态来控制在移动端时侧边栏的显示
  const [showSider, setShowSider] = useState(!isMobile())
  // 添加状态来跟踪当前激活的消息
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const messageAreaRef = useRef<HTMLDivElement>(null)
  // 添加新的状态
  const [isLoadingUsers, setIsLoadingUsers] = useState(true)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)

  const scrollToBottom = () => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // 修改消息接收处理
  useEffect(() => {
    setIsLoadingUsers(true)
    const newSocket = io('https://hls.chenpaopao.com:8888', {
      reconnection: false,
    })

    newSocket.emit('user:login', {
      id: currentUser.id,
      username: currentUser.username,
    })

    newSocket.on('users:online', (users: ChatUser[]) => {
      setOnlineUsers(users.filter((user) => user.socketId !== newSocket.id))
      setIsLoadingUsers(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [currentUser.id, currentUser.username])

  // 单独处理新消息接收
  useEffect(() => {
    if (!socket) return

    const handleNewMessage = (message: Message) => {
      // 更新未读消息计数
      if (
        message.from.id !== currentUser.id && // 不是自己发的消息
        (!selectedUser || message.from.id !== selectedUser.id) // 不是当前聊天窗口
      ) {
        if (message.isGroupMessage) {
          // 群聊消息
          setOnlineUsers(prev => prev.map(user => 
            user.id === 'group_all'
              ? { ...user, unreadCount: (user.unreadCount || 0) + 1 }
              : user
          ))
        } else {
          // 私聊消息
          setOnlineUsers(prev => prev.map(user => 
            user.id === message.from.id
              ? { ...user, unreadCount: (user.unreadCount || 0) + 1 }
              : user
          ))
        }
      }

      // 只有当消息属于当前聊天时才显示
      if (selectedUser && (
        (message.isGroupMessage && selectedUser.id === 'group_all') ||
        (!message.isGroupMessage && (
          message.from.id === selectedUser.id || 
          message.to.id === selectedUser.id
        ))
      )) {
        setMessages(prev => [...prev, message])
      }
    }

    socket.on('message:receive', handleNewMessage)
    return () => socket.off('message:receive', handleNewMessage)
  }, [socket, selectedUser, currentUser.id])

  // 监听消息变化，自动滚动到底部
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // 监听消息区域的滚动
  const handleScroll = () => {
    const messageArea = messageAreaRef.current
    if (!messageArea || isLoadingMore || !hasMore) return

    // 当滚动到顶部时加载更多
    if (messageArea.scrollTop === 0) {
      loadMoreMessages()
    }
  }

  // 加载更多消息
  const loadMoreMessages = () => {
    if (!selectedUser || !socket || isLoadingMore || !hasMore) return
    setIsLoadingMore(true)

    socket.emit('message:history', {
      userId1: currentUser.id,
      userId2: selectedUser.id,
      page: currentPage,
      pageSize: 5
    })
  }

  // 修改历史消息处理
  useEffect(() => {
    if (selectedUser && socket) {
      // 重置状态
      setCurrentPage(1)
      setHasMore(true)
      setMessages([])
      setIsLoadingMessages(true)
      
      const handleMessageHistory = ({ messages: newMessages, hasMore: more }: MessageHistoryResponse) => {
        console.log('newMessages 历史消息', newMessages)
        setIsLoadingMessages(false)
        setIsLoadingMore(false)
        if (currentPage === 1) {
          setMessages(newMessages)
        } else {
          setMessages(prev => [...newMessages, ...prev])
        }
        setHasMore(more)
        setCurrentPage(prev => prev + 1)
      }

      // 请求历史消息
      console.log('请求历史消息', currentUser.id, selectedUser.id)
      socket.emit('message:history', {
        userId1: currentUser.id,
        userId2: selectedUser.id,
        page: 1,
        pageSize: 20
      })

      socket.on('message:history', handleMessageHistory)

      return () => {
        socket.off('message:history', handleMessageHistory)
      }
    }
  }, [selectedUser, socket, currentUser.id]) // 移除 currentPage 依赖

  // 在 useEffect 中添加窗口大小变化监听
  useEffect(() => {
    const handleResize = () => {
      setShowSider(!isMobile())
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
        socketId: socket.id,
      },
      to: selectedUser,
      content: message,
    }

    console.log('newMessage', newMessage)
    socket.emit('message:send', newMessage)
    setMessage('')
  }

  const handleMessageClick = (messageId: string) => {
    if (activeMessageId === messageId) {
      setActiveMessageId(null)
    } else {
      setActiveMessageId(messageId)
    }
  }

  const renderMessage = (msg: Message) => {
    const isSelf = msg.from.id === currentUser.id
    const isGroupMessage = msg.isGroupMessage
    const messageTime = new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })

    return (
      <div
        key={msg.id}
        className={`${styles.messageItem} ${isSelf ? styles.messageSelf : ''} ${
          activeMessageId === msg.id ? styles.messageItemActive : ''
        }`}
        onClick={() => handleMessageClick(msg.id)}
      >
        <Avatar
          className={styles.avatar}
          size={40}
          style={{
            backgroundColor: isSelf ? '#1d9bf0' : '#f0f0f0',
            color: isSelf ? '#fff' : '#666',
          }}
        >
          {getAvatarText(msg.from.username)}
        </Avatar>
        <div className={styles.messageContent}>
          <div className={styles.messageUser}>
            <span className={styles.messageUserName}>
              {isGroupMessage
                ? isSelf
                  ? '我'
                  : msg.from.username
                : isSelf
                  ? '我'
                  : msg.from.username}
            </span>
            <span className={styles.messageTime}>{messageTime}</span>
          </div>
          <div className={styles.messageText}>{msg.content}</div>
        </div>
      </div>
    )
  }

  // 选择用户时清除未读计数
  const handleSelectUser = (user: ChatUserWithUnread) => {
    setSelectedUser(user)
    setOnlineUsers(prev => prev.map(u => 
      u.id === user.id ? { ...u, unreadCount: 0 } : u
    ))
    if (isMobile()) {
      setShowSider(false)
    }
  }

  return (
    <Layout className={styles.chatLayout}>
      <Header className={styles.header}>
        {isMobile() && selectedUser && (
          <Button className={styles.backButton} onClick={() => setSelectedUser(null)}>
            返回
          </Button>
        )}
        <div className={styles.userInfo}>
          <Avatar style={{ backgroundColor: '#1d9bf0', color: '#fff' }}>
            {getAvatarText(currentUser.username)}
          </Avatar>
          <span className={styles.username}>{currentUser.username}</span>
        </div>
        <Button onClick={handleLogout}>退出</Button>
      </Header>
      <Layout>
        {(!selectedUser || !isMobile() || showSider) && (
          <Sider width={isMobile() ? '100%' : 300} className={styles.sider}>
            <List
              className={styles.chatList}
              itemLayout="horizontal"
              dataSource={onlineUsers}
              loading={isLoadingUsers}
              locale={{ emptyText: '暂无在线用户' }}
              renderItem={(item) => (
                <List.Item
                  className={styles.chatItem}
                  onClick={() => handleSelectUser(item)}
                >
                  <List.Item.Meta
                    avatar={
                      <Avatar style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
                        {getAvatarText(item.username)}
                      </Avatar>
                    }
                    title={
                      <div className={styles.userTitle}>
                        <span>{item.username}</span>
                        {item.unreadCount ? (
                          <span className={styles.unreadBadge}>
                            {item.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Sider>
        )}
        {(!isMobile() || selectedUser) && (
          <Content className={styles.content}>
            {selectedUser ? (
              <>
                <div className={styles.chatHeader}>{selectedUser.username}</div>
                <div 
                  ref={messageAreaRef}
                  className={styles.messageArea}
                  onScroll={handleScroll}
                >
                  {isLoadingMore && (
                    <div className={styles.loadingMore}>
                      加载更多...
                    </div>
                  )}
                  {isLoadingMessages ? (
                    <div className={styles.loading}>
                      <div className={styles.loadingDots}>
                        <span></span>
                        <span></span>
                        <span></span>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className={styles.noMessages}>
                      暂无消息记录
                    </div>
                  ) : (
                    messages.map(renderMessage)
                  )}
                  <div ref={messageEndRef} />
                </div>
                <div className={styles.inputArea}>
                  <Input.TextArea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="请输入消息"
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    onPressEnter={(e) => {
                      if (e.nativeEvent.isComposing) return
                      if (!e.shiftKey) {
                        e.preventDefault()
                        handleSendMessage()
                      }
                    }}
                  />
                  <Button type="primary" icon={<SendOutlined />} onClick={handleSendMessage}>
                    发送
                  </Button>
                </div>
              </>
            ) : (
              <div className={styles.noChat}>请选择一个聊天</div>
            )}
          </Content>
        )}
      </Layout>
    </Layout>
  )
}

export default Chat
