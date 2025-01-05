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
// 在文件开头添加在线用户表
const online_users = new Map<string, { user_id: string, socket_id: string }>()

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

// 添加 Socket 类型扩展
interface CustomSocket extends Socket {
  user_id?: string;
}

io.on('connection', (socket: CustomSocket) => {
  console.log('用户连接:', socket.id)

  // 用户登录
  socket.on('user:login', (user) => {
    socket.user_id = user.id
    userSocketMap.set(user.id, socket.id)
    online_users.set(socket.id, { user_id: user.id, socket_id: socket.id })

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

      // 直接获取好友列表
      getFriendsList(user.id, socket)
    })
  })

  // 搜索用户
  socket.on('users:search', ({ username }) => {
    if (!socket.user_id) {
      socket.emit('users:search:result', [])
      return
    }

    const query = `
      SELECT u.id, u.username,
             CASE WHEN f.friend_id IS NOT NULL THEN 1 ELSE 0 END as is_friend
      FROM users u
      LEFT JOIN friendships f ON f.friend_id = u.id AND f.user_id = ?
      WHERE u.username LIKE ? AND u.id != ?
      LIMIT 10
    `
    
    db.all(query, [socket.user_id, `%${username}%`, socket.user_id], (err, users) => {
      if (err) {
        console.error('Error searching users:', err)
        socket.emit('users:search:result', [])
        return
      }

      const results = users.map(user => ({
        id: user.id,
        username: user.username,
        isFriend: Boolean(user.is_friend),
        isOnline: Boolean(userSocketMap.get(user.id))
      }))

      socket.emit('users:search:result', results)
    })
  })

  // 获取好友列表的辅助函数
  const getFriendsList = (userId: string, socket: Socket) => {
    const query = `
      SELECT 
        u.id, 
        u.username,
        f.created_at as friend_since,
        (
          SELECT COUNT(*)
          FROM messages m
          WHERE m.chat_id = CASE 
            WHEN m.is_group_message = 1 THEN 'group_all'
            ELSE (
              CASE 
                WHEN m.from_user_id < m.to_user_id 
                THEN m.from_user_id || ':' || m.to_user_id
                ELSE m.to_user_id || ':' || m.from_user_id
              END
            )
          END
          AND (
            (m.is_group_message = 0 AND (m.from_user_id = u.id OR m.to_user_id = u.id))
            OR
            (m.is_group_message = 1)
          )
          AND m.timestamp > COALESCE(
            (
              SELECT MAX(timestamp)
              FROM message_reads
              WHERE user_id = ? AND (
                (is_group_message = 0 AND friend_id = u.id)
                OR
                (is_group_message = 1 AND friend_id = 'group_all')
              )
            ),
            '1970-01-01'
          )
        ) as unread_count
      FROM users u
      INNER JOIN friendships f ON f.friend_id = u.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `

    db.all(query, [userId, userId], (err, friends) => {
      if (err) {
        console.error('Error fetching friends:', err)
        return
      }

      const friendsList = [
        {
          ...groupChat,
          isOnline: true,
          unreadCount: 0 // 群聊未读消息数会在上面的查询中计算
        },
        ...friends.map(f => ({
          id: f.id,
          username: f.username,
          socketId: userSocketMap.get(f.id) || null,
          isOnline: Boolean(userSocketMap.get(f.id)),
          unreadCount: f.unread_count,
          friendSince: f.friend_since
        }))
      ]

      socket.emit('friends:list', friendsList)
    })
  }

  // 断开连接时更新在线状态
  socket.on('disconnect', () => {
    const user = online_users.get(socket.id)
    if (user) {
      online_users.delete(socket.id)
      userSocketMap.delete(user.user_id)
      
      // 通知所有好友该用户下线
      notifyFriendsStatus(user.user_id, false)
    }
  })

  // 通知好友状态变化的辅助函数
  const notifyFriendsStatus = (userId: string, isOnline: boolean) => {
    const query = `
      SELECT user_id
      FROM friendships
      WHERE friend_id = ?
    `

    db.all(query, [userId], (err, friends) => {
      if (err) {
        console.error('Error fetching friends for status update:', err)
        return
      }

      friends.forEach(friend => {
        const friendSocket = userSocketMap.get(friend.user_id)
        if (friendSocket) {
          io.to(friendSocket).emit('friend:status', {
            friendId: userId,
            isOnline
          })
        }
      })
    })
  }

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

  // 添加好友
  socket.on('friend:add', ({ friendId }) => {
    if (!socket.user_id) {
      socket.emit('friend:add:error', { message: '未登录' })
      return
    }

    const query = `
      INSERT INTO friendships (user_id, friend_id)
      VALUES (?, ?), (?, ?)
    `

    db.run(query, [socket.user_id, friendId, friendId, socket.user_id], (err) => {
      if (err) {
        console.error('Error adding friend:', err)
        socket.emit('friend:add:error', { message: '添加好友失败' })
        return
      }

      // 通知双方更新好友列表
      getFriendsList(socket.user_id, socket)
      const friendSocket = userSocketMap.get(friendId)
      if (friendSocket) {
        getFriendsList(friendId, io.sockets.sockets.get(friendSocket))
      }
      
      socket.emit('friend:added', { success: true })
    })
  })

  // 添加标记消息已读接口
  socket.on('messages:read', ({ chatId }) => {
    if (!socket.user_id) return

    const query = `
      INSERT INTO message_reads (user_id, friend_id, is_group_message, timestamp)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, friend_id, is_group_message)
      DO UPDATE SET timestamp = CURRENT_TIMESTAMP
    `

    const isGroup = chatId === GROUP_ID
    const friendId = isGroup ? GROUP_ID : chatId.split(':').find(id => id !== socket.user_id)

    db.run(query, [socket.user_id, friendId, isGroup ? 1 : 0], (err) => {
      if (err) {
        console.error('Error marking messages as read:', err)
      }
    })
  })
})

const PORT = process.env.PORT || 8090
// @ts-ignore
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`)
})
