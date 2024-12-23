export interface User {
  id: string
  username: string
  avatar?: string
}

export interface Message {
  id: string
  content: string
  senderId: string
  receiverId: string
  timestamp: Date
} 