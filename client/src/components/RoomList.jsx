import { useState } from 'react'
import api from '../utils/api'

function RoomList({ rooms, currentRoom, onSelectRoom, socket }) {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createType, setCreateType] = useState('direct')
  const [targetUsername, setTargetUsername] = useState('')
  const [groupName, setGroupName] = useState('')

  const handleCreateRoom = async () => {
    if (createType === 'direct') {
      if (!targetUsername) {
        alert('请输入对方用户名')
        return
      }

      try {
        // 查找用户
        const res = await api.get(`/auth/find?username=${targetUsername}`)
        const targetUserId = res.data.user.id

        // 通过 Socket 创建房间
        socket.emit('room:create:direct', { targetUserId })
        
        setShowCreateModal(false)
      } catch (error) {
        alert(error.response?.data?.error || '用户不存在')
      }
    } else {
      // TODO: 创建群组
      alert('功能开发中：创建群组')
    }
    setShowCreateModal(false)
  }

  return (
    <div className="room-list">
      <button 
        className="btn-create-room"
        onClick={() => setShowCreateModal(true)}
      >
        + 新建聊天
      </button>

      <div className="rooms">
        {rooms.length === 0 ? (
          <div className="empty-state">暂无聊天</div>
        ) : (
          rooms.map(room => (
            <div
              key={room.id}
              className={`room-item ${currentRoom?.id === room.id ? 'active' : ''}`}
              onClick={() => onSelectRoom(room)}
            >
              <div className="room-info">
                <div className="room-name">
                  {room.type === 'direct' ? '👤' : '👥'} {room.name || '私聊'}
                </div>
                {room.unread_count > 0 && (
                  <span className="unread-badge">{room.unread_count}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="modal" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3>新建聊天</h3>
            
            <div className="form-group">
              <label>类型</label>
              <select value={createType} onChange={e => setCreateType(e.target.value)}>
                <option value="direct">一对一</option>
                <option value="group">群组</option>
              </select>
            </div>

            {createType === 'direct' ? (
              <div className="form-group">
                <label>对方用户名</label>
                <input
                  type="text"
                  value={targetUsername}
                  onChange={e => setTargetUsername(e.target.value)}
                  placeholder="输入用户名"
                />
              </div>
            ) : (
              <div className="form-group">
                <label>群组名称</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  placeholder="输入群组名称"
                />
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setShowCreateModal(false)}>取消</button>
              <button onClick={handleCreateRoom} className="btn-primary">创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoomList
