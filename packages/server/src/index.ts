import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import routes from './routes/index.js'
import config from './config/index.js'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
    methods: ['GET', 'POST']
  }
})

// 中间件
app.use(cors())
app.use(express.json())

// 路由
app.use('/api', routes)

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log('用户连接:', socket.id)

  socket.on('disconnect', () => {
    console.log('用户断开连接:', socket.id)
  })
})

// 启动服务器
const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
}) 