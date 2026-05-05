const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const database = require('./database');

// 在线用户映射
const onlineUsers = new Map();

function socketHandler(io, socket) {
  let currentUserId = null;

  // 用户认证
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      currentUserId = decoded.userId;

      // 记录在线用户
      onlineUsers.set(currentUserId, socket.id);

      // 更新用户状态
      await database.runAsync(
        'UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        ['online', currentUserId]
      );

      socket.join(currentUserId);

      // 通知好友上线
      const rooms = await database.allAsync(
        `SELECT DISTINCT rm2.user_id
        FROM room_members rm1
        INNER JOIN room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = ? AND rm2.user_id != ?`,
        [currentUserId, currentUserId]
      );

      rooms.forEach(room => {
        io.to(room.user_id).emit('user:online', { userId: currentUserId });
      });

      socket.emit('authenticated', { userId: currentUserId });
      console.log(`✅ 用户认证成功: ${decoded.username} (${currentUserId})`);
    } catch (error) {
      socket.emit('auth:error', { error: '认证失败' });
      socket.disconnect();
    }
  });

  // 加入房间
  socket.on('room:join', async (roomId) => {
    if (!currentUserId) return;

    // 检查是否已经在该房间中（防止重复加入）
    const rooms = socket.rooms;
    if (rooms && rooms.has(roomId)) {
      console.log(`ℹ️ 用户 ${currentUserId} 已在房间 ${roomId}，跳过重复加入`);
      return;
    }

    // 检查是否是房间成员
    const member = await database.getAsync(
      'SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, currentUserId]
    );

    if (member) {
      socket.join(roomId);
      console.log(`👥 用户 ${currentUserId} 加入房间 ${roomId}`);
    }
  });

  // 发送消息
  socket.on('message:send', async (data) => {
    if (!currentUserId) return;

    const { roomId, type, content, fileUrl, orderId } = data;

    // 检查是否是房间成员
    const member = await database.getAsync(
      'SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, currentUserId]
    );

    if (!member) {
      socket.emit('message:error', { error: '无权在此房间发送消息' });
      return;
    }

    const messageId = uuidv4();

    // 环信兼容：前端传 txt/img，数据库约束要求 text/image，做映射
    let dbType;
    if (type === 'txt') dbType = 'text';
    else if (type === 'img') dbType = 'image';
    else dbType = type || 'text';

    // 保存消息到数据库
    try {
      await database.runAsync(
        'INSERT INTO messages (id, room_id, sender_id, type, content, file_url, order_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [messageId, roomId, currentUserId, dbType, content, fileUrl || null, orderId || null]
      );

      // 环信风格输出 type: txt/img
      const outType = (dbType === 'text') ? 'txt' : (dbType === 'image' ? 'img' : dbType);

      const message = {
        id: messageId,
        room_id: roomId,
        sender_id: currentUserId,
        // 环信兼容字段
        from: currentUserId,
        msg: content,
        type: outType,
        content,
        url: fileUrl || undefined,    // 环信图片标准字段
        file_url: fileUrl,
        order_id: orderId,
        created_at: new Date().toISOString()
      };

      // 广播给房间内所有用户
      console.log(`📡 准备广播消息到房间 ${roomId}`);
      io.to(roomId).emit('message:new', message);
      console.log(`✅ 广播完成`);

      console.log(`💬 消息发送: ${currentUserId} -> ${roomId}`);
      console.log(`📤 广播消息:`, message);
    } catch (error) {
      console.error('消息发送失败:', error);
      socket.emit('message:error', { error: '消息发送失败' });
    }
  });

  // 环信兼容：直接向目标用户发送消息（自动查找或创建 direct room）
  socket.on('message:send:direct', async (data) => {
    if (!currentUserId) return;

    const { to, content } = data;
    let type = data.type || 'text';

    if (!to || !content) {
      socket.emit('message:error', { error: '缺少必填字段: to, content' });
      return;
    }

    // 1. 查找或创建两个用户之间的 direct room
    const existing = await database.getAsync(
      `SELECT r.id FROM rooms r
      INNER JOIN room_members rm1 ON r.id = rm1.room_id AND rm1.user_id = ?
      INNER JOIN room_members rm2 ON r.id = rm2.room_id AND rm2.user_id = ?
      WHERE r.type = 'direct'`,
      [currentUserId, to]
    );

    let roomId;
    if (existing) {
      roomId = existing.id;
    } else {
      roomId = uuidv4();
      await database.runAsync(
        'INSERT INTO rooms (id, type, created_by, is_active) VALUES (?, ?, ?, ?)',
        [roomId, 'direct', currentUserId, 1]
      );
      await database.runAsync(
        'INSERT OR IGNORE INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
        [roomId, currentUserId, 'member']
      );
      await database.runAsync(
        'INSERT OR IGNORE INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
        [roomId, to, 'member']
      );
      // 通知双方
      socket.join(roomId);
      io.to(to).emit('room:created', { roomId });
      socket.emit('room:created', { roomId });
    }

    // 2. 发送消息
    const messageId = uuidv4();
    // 环信兼容：txt → text 入库
    const dbType = (type === 'txt') ? 'text' : type;
    try {
      await database.runAsync(
        'INSERT INTO messages (id, room_id, sender_id, type, content) VALUES (?, ?, ?, ?, ?)',
        [messageId, roomId, currentUserId, dbType, content]
      );

      const message = {
        id: messageId,
        room_id: roomId,
        sender_id: currentUserId,
        from: currentUserId,
        msg: content,
        type: type === 'txt' ? 'txt' : type,
        content,
        created_at: new Date().toISOString()
      };

      io.to(roomId).emit('message:new', message);
      console.log(`💬 直接消息: ${currentUserId} -> ${to} (room: ${roomId})`);
    } catch (error) {
      console.error('直接消息发送失败:', error);
      socket.emit('message:error', { error: '消息发送失败' });
    }
  });

  // 标记消息已读
  socket.on('message:read', async (data) => {
    if (!currentUserId) return;

    const { messageId } = data;

    await database.runAsync(
      'INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)',
      [messageId, currentUserId]
    );

    // 通知发送者
    const message = await database.getAsync('SELECT sender_id FROM messages WHERE id = ?', [messageId]);
    if (message) {
      io.to(message.sender_id).emit('message:read:ack', { messageId, userId: currentUserId });
    }
  });

  // 输入状态提示
  socket.on('typing:start', (data) => {
    if (!currentUserId) return;
    socket.to(data.roomId).emit('user:typing', { userId: currentUserId, roomId: data.roomId });
  });

  socket.on('typing:stop', (data) => {
    if (!currentUserId) return;
    socket.to(data.roomId).emit('user:stop_typing', { userId: currentUserId, roomId: data.roomId });
  });

  // 创建一对一房间
  socket.on('room:create:direct', async (data) => {
    if (!currentUserId) return;

    const { targetUserId } = data;

    // 检查目标用户是否存在（支持用户名或 UUID）
    let targetUser;
    if (targetUserId.includes('-')) {
      // UUID 格式
      targetUser = await database.getAsync('SELECT id FROM users WHERE id = ?', [targetUserId]);
    } else {
      // 用户名格式
      targetUser = await database.getAsync('SELECT id FROM users WHERE username = ?', [targetUserId]);
    }
    
    if (!targetUser) {
      console.log(`️ 目标用户不存在: ${targetUserId}`);
      socket.emit('room:error', { error: '目标用户不存在，请先注册该用户' });
      return;
    }

    const targetUserUUID = targetUser.id;

    // 检查是否已存在房间
    const existing = await database.getAsync(
      `SELECT r.id FROM rooms r
      INNER JOIN room_members rm1 ON r.id = rm1.room_id AND rm1.user_id = ?
      INNER JOIN room_members rm2 ON r.id = rm2.room_id AND rm2.user_id = ?
      WHERE r.type = 'direct'`,
      [currentUserId, targetUserUUID]
    );

    if (existing) {
      socket.emit('room:created', { roomId: existing.id });
      return;
    }

    const roomId = uuidv4();

    // 创建房间
    await database.runAsync(
      'INSERT INTO rooms (id, type, created_by, order_id, metadata, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      [roomId, 'direct', currentUserId, data.orderId || null, JSON.stringify(data.metadata || {}), 1]
    );
    
    // 添加成员（使用 INSERT OR IGNORE 避免重复）
    await database.runAsync(
      'INSERT OR IGNORE INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
      [roomId, currentUserId, 'member']
    );
    await database.runAsync(
      'INSERT OR IGNORE INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
      [roomId, targetUserUUID, 'member']
    );

    socket.emit('room:created', { roomId });
    io.to(targetUserUUID).emit('room:invite', { roomId, from: currentUserId });
  });

  // 创建群组房间
  socket.on('room:create:group', async (data) => {
    if (!currentUserId) return;

    const { name, description, memberIds } = data;

    if (!name || !memberIds || memberIds.length === 0) {
      socket.emit('room:error', { error: '群组名称和成员不能为空' });
      return;
    }

    const roomId = uuidv4();

    await database.runAsync(
      'INSERT INTO rooms (id, type, name, description, created_by) VALUES (?, ?, ?, ?, ?)',
      [roomId, 'group', name, description, currentUserId]
    );

    // 添加创建者
    await database.runAsync(
      'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
      [roomId, currentUserId, 'admin']
    );

    // 添加成员
    for (const memberId of memberIds) {
      if (memberId !== currentUserId) {
        await database.runAsync(
          'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
          [roomId, memberId]
        );
      }
    }

    socket.emit('room:created', { roomId });
    socket.join(roomId);

    // 通知所有成员
    memberIds.forEach(memberId => {
      if (memberId !== currentUserId) {
        io.to(memberId).emit('room:invite', { roomId, name, from: currentUserId });
      }
    });
  });

  // 断开连接
  socket.on('disconnect', async () => {
    if (currentUserId) {
      onlineUsers.delete(currentUserId);

      // 更新用户状态
      await database.runAsync(
        'UPDATE users SET status = ?, last_seen = CURRENT_TIMESTAMP WHERE id = ?',
        ['offline', currentUserId]
      );

      // 通知好友下线
      const rooms = await database.allAsync(
        `SELECT DISTINCT rm2.user_id
        FROM room_members rm1
        INNER JOIN room_members rm2 ON rm1.room_id = rm2.room_id
        WHERE rm1.user_id = ? AND rm2.user_id != ?`,
        [currentUserId, currentUserId]
      );

      rooms.forEach(room => {
        io.to(room.user_id).emit('user:offline', { userId: currentUserId });
      });

      console.log(`❌ 用户断开连接: ${currentUserId}`);
    }
  });
}

// 获取在线用户数
function getOnlineCount() {
  return onlineUsers.size;
}

module.exports = socketHandler;
module.exports.getOnlineCount = getOnlineCount;
