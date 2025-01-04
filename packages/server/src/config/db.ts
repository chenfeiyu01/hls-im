import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, '../../data/chat.db')

// 确保 data 目录存在
import fs from 'fs'
const dataDir = path.dirname(dbPath)
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

export const db = new sqlite3.Database(dbPath)

export const initDB = () => {
  db.serialize(() => {
    // 创建用户表
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // 创建消息表
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        from_user_id TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        is_group_message INTEGER DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (from_user_id) REFERENCES users (id)
      )
    `)

    // 创建索引
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`)
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`)
  })
}