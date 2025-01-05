export interface ChatUser {
  id: string
  username: string
  socketId: string | null
  isGroup?: boolean
  isOnline?: boolean
  isFriend?: boolean
  unreadCount?: number
}

export interface SearchResult extends ChatUser {
  isFriend: boolean
}

export interface Message {
  id: string
  content: string
  from: ChatUser
  to: ChatUser
  timestamp: Date
  isGroupMessage?: boolean
}

export interface AddFriendResponse {
  success: boolean;
  message?: string;
} 