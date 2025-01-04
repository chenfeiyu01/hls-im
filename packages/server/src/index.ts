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
    methods: ['GET', 'POST'],
  },
})

// 存储群聊信息
const GROUP_ID = 'group_all'
const groupChat = {
  id: GROUP_ID,
  username: '公共群聊',
  socketId: GROUP_ID,
  isGroup: true,
}

// 存储在线用户
const onlineUsers = new Map()
// 存储消息历史
const messageHistory = new Map<string, any[]>()
// 存储用户 ID 到 socket ID 的映射
const userSocketMap = new Map<string, string>()

app.use(cors())
app.use(express.json())
app.use('/api', routes)

interface DBMessage {
  id: string
  content: string
  from_user_id: string
  to_user_id: string
  chat_id: string
  from_username: string
  is_group_message: number
  timestamp: string
}

io.on('connection', (socket) => {
  console.log('用户连接:', socket.id)

  // 用户登录
  socket.on('user:login', (user) => {
    // 保存用户 ID 和 socket ID 的映射
    userSocketMap.set(user.id, socket.id)

    const query = `
      INSERT OR REPLACE INTO users (id, username)
      VALUES (?, ?)
    `
    
    db.run(query, [user.id, user.username], (err) => {
      if (err) {
        console.error('Error saving user:', err)
        return
      }

      socket.join(GROUP_ID)
      onlineUsers.set(socket.id, { ...user, socketId: socket.id })
      const onlineUsersList = Array.from(onlineUsers.values())
      io.emit('users:online', [groupChat, ...onlineUsersList])
    })
  })

  // 断开连接时清理映射
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id)
    if (user) {
      userSocketMap.delete(user.id)
    }
    onlineUsers.delete(socket.id)
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

          const messageToSend = {
            id: newMessageId,
            content,
            from,
            to,
            timestamp: new Date(timestamp),
            isGroupMessage: true,
          }

          io.to(GROUP_ID).emit('message:receive', messageToSend)
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
          timestamp: new Date(timestamp),
        }

        // 使用 userSocketMap 获取接收方的 socket ID
        const receiverSocketId = userSocketMap.get(to.id)
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message:receive', messageToSend)
        }
        socket.emit('message:receive', messageToSend)
      })
    } catch (error) {
      console.error('Error in message:send:', error)
    }
  })

  // 获取历史消息
  socket.on('message:history', ({ userId1, userId2, page = 1, pageSize = 20 }) => {
    const chatId = userId2 === GROUP_ID ? GROUP_ID : [userId1, userId2].sort().join(':')
    console.log('查询历史消息:', { chatId, userId1, userId2, page, pageSize })

    // 修改查询语句，检查所有字段
    const query = `
      SELECT 
        m.id, m.content, m.from_user_id, m.to_user_id, 
        m.chat_id, m.is_group_message, m.timestamp,
        u.username as from_username
      FROM messages m
      LEFT JOIN users u ON m.from_user_id = u.id
      WHERE m.chat_id = ?
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `

    const offset = (page - 1) * pageSize
    console.log('SQL参数:', { chatId, pageSize, offset })

    // 先检查消息表
    db.all('SELECT * FROM messages WHERE chat_id = ?', [chatId], (err, allMessages) => {
      console.log('所有消息:', allMessages)
    })

    // 检查用户表
    db.all('SELECT * FROM users', [], (err, allUsers) => {
      console.log('所有用户:', allUsers)
    })

    db.all(query, [chatId, pageSize, offset], (err, rows) => {
      if (err) {
        console.error('Error fetching message history:', err)
        socket.emit('message:history', { messages: [], hasMore: false })
        return
      }

      console.log('查询结果:', rows)

      const messages = rows.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        from: {
          id: msg.from_user_id,
          username: msg.from_username,
        },
        to: {
          id: msg.to_user_id,
        },
        timestamp: new Date(msg.timestamp),
        isGroupMessage: Boolean(msg.is_group_message),
      }))

      // 检查是否还有更多消息
      const countQuery = `
        SELECT COUNT(*) as total
        FROM messages
        WHERE chat_id = ?
      `

      db.get(countQuery, [chatId], (err, row: any) => {
        if (err) {
          console.error('Error counting messages:', err)
          socket.emit('message:history', { messages: [], hasMore: false })
          return
        }

        console.log('消息总数:', row)
        const total = row?.total || 0
        const hasMore = total > page * pageSize

        socket.emit('message:history', {
          messages: messages.reverse(),
          hasMore,
          total,
        })
      })
    })
  })
})

const PORT = process.env.PORT || 8090
// @ts-ignore
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
