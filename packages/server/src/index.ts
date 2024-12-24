import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import routes from './routes/index.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// 存储群聊信息
const GROUP_ID = 'group_all'
const groupChat = {
  id: GROUP_ID,
  username: '公共群聊',
  socketId: GROUP_ID,
  isGroup: true
}

// 存储在线用户
const onlineUsers = new Map()
// 存储消息历史
const messageHistory = new Map<string, any[]>()

app.use(cors())
app.use(express.json())
app.use('/api', routes)

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id)

  // 用户登录
  socket.on('user:login', (user) => {
    // 将用户加入群聊房间
    socket.join(GROUP_ID)

    onlineUsers.set(socket.id, { ...user, socketId: socket.id })
    const onlineUsersList = Array.from(onlineUsers.values())

    // 广播在线用户列表，包含群聊
    io.emit('users:online', [groupChat, ...onlineUsersList])
  })

  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id)
    onlineUsers.delete(socket.id)
    // 广播更新后的用户列表，保持群聊始终存在
    io.emit('users:online', [groupChat, ...Array.from(onlineUsers.values())])
  })

  // 处理新消息
  socket.on('message:send', (message) => {
    console.log('message:send', message)
    const { from, to, content } = message

    // 处理群聊消息
    if (to.id === GROUP_ID) {
      const newMessage = {
        id: Date.now().toString(),
        content,
        from,
        to,
        timestamp: new Date(),
        isGroupMessage: true
      }

      // 保存群聊消息
      if (!messageHistory.has(GROUP_ID)) {
        messageHistory.set(GROUP_ID, [])
      }
      messageHistory.get(GROUP_ID)?.push(newMessage)

      // 广播给所有群成员
      io.to(GROUP_ID).emit('message:receive', newMessage)
      return
    }

    // 处理私聊消息
    const chatId = [from.id, to.id].sort().join(':')
    if (!messageHistory.has(chatId)) {
      messageHistory.set(chatId, [])
    }
    const newMessage = {
      id: Date.now().toString(),
      content,
      from,
      to,
      timestamp: new Date()
    }
    messageHistory.get(chatId)?.push(newMessage)

    io.to(to.socketId).emit('message:receive', newMessage)
    socket.emit('message:receive', newMessage)
  })

  // 获取历史消息
  socket.on('message:history', ({ userId1, userId2 }) => {
    // 获取群聊消息
    if (userId2 === GROUP_ID) {
      const messages = messageHistory.get(GROUP_ID) || []
      socket.emit('message:history', messages)
      return
    }

    // 获取私聊消息
    const chatId = [userId1, userId2].sort().join(':')
    const messages = messageHistory.get(chatId) || []
    socket.emit('message:history', messages)
  })
})

const PORT = 6000
// @ts-ignore
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
}) 