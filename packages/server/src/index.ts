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
    onlineUsers.set(socket.id, { ...user, socketId: socket.id })
    // 广播在线用户列表
    io.emit('users:online', Array.from(onlineUsers.values()))
  })

  // 断开连接
  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id)
    onlineUsers.delete(socket.id)
    io.emit('users:online', Array.from(onlineUsers.values()))
  })

  // 处理新消息
  socket.on('message:send', (message) => {
    console.log('message:send', message)
    const { from, to, content } = message
    const chatId = [from.id, to.id].sort().join(':')
    
    // 保存消息
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

    // 发送给相关用户
    io.to(to.socketId).emit('message:receive', newMessage)
    socket.emit('message:receive', newMessage)
  })

  // 获取历史消息
  socket.on('message:history', ({ userId1, userId2 }) => {
    const chatId = [userId1, userId2].sort().join(':')
    const messages = messageHistory.get(chatId) || []
    socket.emit('message:history', messages)
  })
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
}) 