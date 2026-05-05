import { useState, useEffect, useRef } from 'react'
import io from 'socket.io-client'
import api from '../utils/api'
import RoomList from './RoomList'
import MessageArea from './MessageArea'

function Chat({ user, onLogout }) {
  const [rooms, setRooms] = useState([])
  const [currentRoom, setCurrentRoom] = useState(null)
  const [messages, setMessages] = useState([])
  const [socket, setSocket] = useState(null)
  const socketRef = useRef(null)

  // 初始化 Socket.IO
  useEffect(() => {
    const token = localStorage.getItem('token')
    const newSocket = io('http://localhost:3000', {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    })

    // 请求浏览器通知权限
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    newSocket.on('connect', () => {
      console.log('✅ Socket 连接成功')
      // 认证
      newSocket.emit('authenticate', token)
    })

    newSocket.on('authenticated', () => {
      console.log('✅ Socket 认证成功')
      loadRooms()
    })

    // 接收新消息
    newSocket.on('message:new', (message) => {
      setMessages(prev => {
        if (message.room_id === currentRoom?.id) {
          return [...prev, message]
        }
        return prev
      })

      // 更新房间未读数
      setRooms(prev => prev.map(room => {
        if (room.id === message.room_id) {
          return { ...room, unread_count: (room.unread_count || 0) + 1 }
        }
        return room
      }))

      // 浏览器通知（只通知非当前房间的消息）
      if (message.room_id !== currentRoom?.id && 'Notification' in window && Notification.permission === 'granted') {
        const room = rooms.find(r => r.id === message.room_id)
        new Notification('新消息', {
          body: message.type === 'image' ? '[图片]' : message.content,
          icon: '/vite.svg'
        })
      }
    })

    // 房间创建成功
    newSocket.on('room:created', async ({ roomId }) => {
      console.log('✅ 房间创建成功:', roomId)
      
      // 重新加载房间列表
      const res = await api.get('/messages/rooms')
      setRooms(res.data.rooms)
      
      // 自动加入房间
      newSocket.emit('room:join', roomId)
      
      // 自动打开聊天窗口
      const newRoom = res.data.rooms.find(r => r.id === roomId)
      if (newRoom) {
        setCurrentRoom(newRoom)
        
        // 加载消息
        const msgRes = await api.get(`/messages/rooms/${roomId}/messages?limit=50`)
        setMessages(msgRes.data.messages)
      }
    })

    // 用户在线状态
    newSocket.on('user:online', ({ userId }) => {
      console.log('用户上线:', userId)
    })

    newSocket.on('user:offline', ({ userId }) => {
      console.log('用户下线:', userId)
    })

    // 断线重连后获取离线消息
    newSocket.on('reconnect', async () => {
      console.log('🔄 Socket 重连成功')
      newSocket.emit('authenticate', token)
      
      const lastMessage = messages[messages.length - 1]
      if (lastMessage) {
        try {
          const res = await api.get(`/messages/offline?since=${lastMessage.created_at}`)
          if (res.data.messages.length > 0) {
            setMessages(prev => [...prev, ...res.data.messages])
          }
        } catch (error) {
          console.error('获取离线消息失败:', error)
        }
      }
    })

    socketRef.current = newSocket
    setSocket(newSocket)

    return () => {
      newSocket.close()
    }
  }, [])

  // 加载房间列表
  const loadRooms = async () => {
    try {
      const res = await api.get('/messages/rooms')
      setRooms(res.data.rooms)
    } catch (error) {
      console.error('加载房间失败:', error)
    }
  }

  // 选择房间
  const selectRoom = async (room) => {
    setCurrentRoom(room)
    setMessages([])

    // 加入房间
    if (socket) {
      socket.emit('room:join', room.id)
    }

    // 加载历史消息
    try {
      const res = await api.get(`/messages/rooms/${room.id}/messages?limit=50`)
      setMessages(res.data.messages)
      
      // 清除未读
      setRooms(prev => prev.map(r => 
        r.id === room.id ? { ...r, unread_count: 0 } : r
      ))
    } catch (error) {
      console.error('加载消息失败:', error)
    }
  }

  // 发送消息
  const sendMessage = (type, content, fileUrl = null) => {
    if (!socket || !currentRoom) return

    socket.emit('message:send', {
      roomId: currentRoom.id,
      type,
      content,
      fileUrl
    })
  }

  // 发送图片
  const sendImage = async (file) => {
    const formData = new FormData()
    formData.append('image', file)

    try {
      const res = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      sendMessage('image', '图片', res.data.url)
    } catch (error) {
      console.error('图片上传失败:', error)
      alert('图片上传失败')
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <div className="sidebar-header">
          <h2>聊天</h2>
          <button onClick={onLogout} className="btn-logout">退出</button>
        </div>
        <RoomList 
          rooms={rooms} 
          currentRoom={currentRoom} 
          onSelectRoom={selectRoom}
          socket={socket}
        />
      </div>
      
      <div className="chat-main">
        {currentRoom ? (
          <MessageArea
            room={currentRoom}
            user={user}
            messages={messages}
            onSendMessage={sendMessage}
            onSendImage={sendImage}
            socket={socket}
          />
        ) : (
          <div className="no-room-selected">
            <h3>选择一个房间开始聊天</h3>
          </div>
        )}
      </div>
    </div>
  )
}

export default Chat
