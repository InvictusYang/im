const express = require('express');
const { v4: uuidv4 } = require('uuid');
const database = require('../database');

const router = express.Router();

// JWT 验证中间件
function authenticateToken(req, res, next) {
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: '无效的认证令牌' });
    }
    req.userId = decoded.userId;
    next();
  });
}

// 获取用户的所有房间
router.get('/rooms', authenticateToken, async (req, res) => {
  try {
    const rooms = await database.allAsync(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM messages WHERE room_id = r.id AND sender_id != ?) as message_count,
        (SELECT COUNT(*) FROM messages m 
         WHERE m.room_id = r.id 
         AND m.sender_id != ?
         AND m.id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?)
        ) as unread_count
      FROM rooms r
      INNER JOIN room_members rm ON r.id = rm.room_id
      WHERE rm.user_id = ?
      ORDER BY (SELECT MAX(created_at) FROM messages WHERE room_id = r.id) DESC`,
      [req.userId, req.userId, req.userId, req.userId]
    );

    res.json({ rooms });
  } catch (error) {
    console.error('获取房间列表错误:', error);
    res.status(500).json({ error: '获取房间列表失败' });
  }
});

// 获取房间消息（分页）
router.get('/rooms/:roomId/messages', authenticateToken, async (req, res) => {
  try {
    const { roomId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // 检查用户是否是房间成员
    const member = await database.getAsync(
      'SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    );

    if (!member) {
      return res.status(403).json({ error: '无权访问此房间' });
    }

    // 获取消息
    const messages = await database.allAsync(
      `SELECT m.*, u.username as sender_username, u.display_name as sender_name, u.avatar as sender_avatar
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.room_id = ? AND m.is_deleted = 0
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?`,
      [roomId, limit, offset]
    );

    // 标记消息为已读
    const unreadMessageIds = messages.filter(m => m.sender_id !== req.userId).map(m => m.id);
    if (unreadMessageIds.length > 0) {
      for (const id of unreadMessageIds) {
        await database.runAsync(
          'INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)',
          [id, req.userId]
        );
      }
    }

    res.json({ messages: messages.reverse().map(m => ({
      ...m,
      // 环信兼容字段
      from: m.sender_id,
      msg: m.content,
      type: m.type === 'text' ? 'txt' : (m.type === 'image' ? 'img' : m.type),
      url: m.file_url || undefined
    })) });
  } catch (error) {
    console.error('获取消息错误:', error);
    res.status(500).json({ error: '获取消息失败' });
  }
});

// 搜索消息（FTS5）
router.get('/search', authenticateToken, async (req, res) => {
  try {
    const { q, roomId } = req.query;

    if (!q) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }

    let sql = `
      SELECT m.*, u.username as sender_username, u.display_name as sender_name
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      INNER JOIN room_members rm ON m.room_id = rm.room_id AND rm.user_id = ?
      WHERE m.content LIKE ?
    `;

    const params = [req.userId, `%${q}%`];

    if (roomId) {
      sql += ' AND m.room_id = ?';
      params.push(roomId);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT 50';

    const messages = await database.allAsync(sql, params);

    res.json({ messages });
  } catch (error) {
    console.error('搜索消息错误:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 获取离线消息
router.get('/offline', authenticateToken, async (req, res) => {
  try {
    const since = req.query.since;

    if (!since) {
      return res.status(400).json({ error: '缺少 since 参数' });
    }

    const messages = await database.allAsync(
      `SELECT m.*, u.username as sender_username, u.display_name as sender_name
      FROM messages m
      INNER JOIN room_members rm ON m.room_id = rm.room_id AND rm.user_id = ?
      INNER JOIN users u ON m.sender_id = u.id
      WHERE m.created_at > ? AND m.sender_id != ?
      ORDER BY m.created_at ASC`,
      [req.userId, since, req.userId]
    );

    res.json({ messages });
  } catch (error) {
    console.error('获取离线消息错误:', error);
    res.status(500).json({ error: '获取离线消息失败' });
  }
});

module.exports = router;
