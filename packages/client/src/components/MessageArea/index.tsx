import React from 'react'
import { Avatar } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { Message, ChatUser } from '@/types'
import './style.scss'

interface Props {
  messages: Message[]
  currentUser: ChatUser
}

const MessageArea: React.FC<Props> = ({ messages, currentUser }) => {
  const renderMessage = (msg: Message) => {
    const isSelf = msg.from.id === currentUser.id
    const isGroupMessage = msg.isGroupMessage
    
    return (
      <div
        key={msg.id}
        className={`message-item ${isSelf ? 'message-self' : ''}`}
      >
        <Avatar icon={<UserOutlined />} />
        <div className="message-content">
          <div className="message-user">
            {isGroupMessage ? (
              <span>{isSelf ? '我' : msg.from.username}</span>
            ) : (
              isSelf ? '我' : msg.from.username
            )}
          </div>
          <div className="message-text">{msg.content}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="message-area">
      {messages.map(renderMessage)}
    </div>
  )
}

export default MessageArea 