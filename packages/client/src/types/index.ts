export interface ChatUser {
  id: string
  username: string
  socketId: string
  isGroup?: boolean
}

export interface Message {
  id: string
  content: string
  from: ChatUser
  to: ChatUser
  timestamp: Date
  isGroupMessage?: boolean
} 