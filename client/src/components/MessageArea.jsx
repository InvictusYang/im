import { useState, useEffect, useRef } from 'react'

function MessageArea({ room, user, messages, onSendMessage, onSendImage, socket }) {
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // 输入状态提示
  const handleTyping = () => {
    if (socket) {
      socket.emit('typing:start', { roomId: room.id })
      
      // 3秒后停止输入
      setTimeout(() => {
        socket.emit('typing:stop', { roomId: room.id })
      }, 3000)
    }
  }

  const handleSend = (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    onSendMessage('text', newMessage)
    setNewMessage('')
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (file) {
      onSendImage(file)
    }
  }

  const formatTime = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date
    
    // 刚刚（1分钟内）
    if (diff < 60000) {
      return '刚刚'
    }
    
    // 今天
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    
    // 昨天
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    }
    
    // 更早
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' + 
           date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="message-area">
      <div className="message-header">
        <h3>{room.type === 'direct' ? '👤' : '👥'} {room.name || '聊天'}</h3>
      </div>

      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">开始聊天吧！</div>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className={`message ${msg.sender_id === user.id ? 'own' : 'other'}`}
            >
              <div className="message-content">
                {msg.type === 'image' ? (
                  <img 
                    src={msg.file_url} 
                    alt="图片" 
                    className="message-image"
                  />
                ) : (
                  <div className="message-text">{msg.content}</div>
                )}
                <div className="message-time">
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="message-input" onSubmit={handleSend}>
        <input
          type="text"
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          onKeyPress={handleTyping}
          placeholder="输入消息..."
        />
        <button 
          type="button" 
          className="btn-icon"
          onClick={() => fileInputRef.current?.click()}
          title="发送图片"
        >
          📷
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleImageUpload}
        />
        <button type="submit" className="btn-send">发送</button>
      </form>
    </div>
  )
}

export default MessageArea
