import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import { db, initDB } from './config/db'
import path from 'path'
import routes from './routes'

// 初始化数据库
initDB()

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

interface DBMessage {
  id: string;
  content: string;
  from_user_id: string;
  to_user_id: string;
  chat_id: string;
  from_username: string;
  is_group_message: number;
  timestamp: string;
}

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
    const { from, to, content } = message

    try {
      const newMessageId = Date.now().toString()
      const timestamp = new Date().toISOString()

      if (to.id === GROUP_ID) {
        const query = `
          INSERT INTO messages (id, content, from_user_id, to_user_id, chat_id, is_group_message, timestamp)
          VALUES (?, ?, ?, ?, ?, 1, ?)
        `
        
        db.run(query, [newMessageId, content, from.id, GROUP_ID, GROUP_ID, timestamp], (err) => {
          if (err) {
            console.error('Error saving group message:', err)
            return
          }

          io.to(GROUP_ID).emit('message:receive', {
            id: newMessageId,
            content,
            from,
            to,
            timestamp: new Date(timestamp),
            isGroupMessage: true
          })
        })
        return
      }

      // 处理私聊消息
      const chatId = [from.id, to.id].sort().join(':')
      const query = `
        INSERT INTO messages (id, content, from_user_id, to_user_id, chat_id, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `

      db.run(query, [newMessageId, content, from.id, to.id, chatId, timestamp], (err) => {
        if (err) {
          console.error('Error saving private message:', err)
          return
        }

        const messageToSend = {
          id: newMessageId,
          content,
          from,
          to,
          timestamp: new Date(timestamp)
        }

        io.to(to.socketId).emit('message:receive', messageToSend)
        socket.emit('message:receive', messageToSend)
      })
    } catch (error) {
      console.error('Error in message:send:', error)
    }
  })

  // 获取历史消息
  socket.on('message:history', ({ userId1, userId2 }) => {
    const chatId = userId2 === GROUP_ID ? GROUP_ID : [userId1, userId2].sort().join(':')
    
    const query = `
      SELECT m.*, u.username as from_username
      FROM messages m
      JOIN users u ON m.from_user_id = u.id
      WHERE m.chat_id = ?
      ORDER BY m.timestamp DESC
      LIMIT 50
    `

    db.all(query, [chatId], (err, rows) => {
      if (err) {
        console.error('Error fetching message history:', err)
        socket.emit('message:history', [])
        return
      }

      const messages = rows.map(msg => ({
        id: msg.id,
        content: msg.content,
        from: {
          id: msg.from_user_id,
          username: msg.from_username
        },
        to: {
          id: msg.to_user_id
        },
        timestamp: new Date(msg.timestamp),
        isGroupMessage: Boolean(msg.is_group_message)
      }))

      socket.emit('message:history', messages.reverse())
    })
  })
})

const PORT = process.env.PORT || 8090
// @ts-ignore
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
}) 