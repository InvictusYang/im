const express = require('express');
const database = require('../database');

const router = express.Router();

// JWT 验证中间件（管理员）
function authenticateAdmin(req, res, next) {
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
    
    // 检查是否是管理员
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    next();
  });
}

// 获取今日聊天室列表
router.get('/rooms/today', authenticateAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const rooms = await database.allAsync(
      `SELECT r.*, 
        (SELECT COUNT(*) FROM messages WHERE room_id = r.id AND DATE(created_at) = ?) as today_message_count,
        (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count,
        (SELECT u.username FROM users u 
         INNER JOIN room_members rm ON u.id = rm.user_id 
         WHERE rm.room_id = r.id AND rm.role = 'admin' LIMIT 1) as cs_username
      FROM rooms r
      WHERE DATE(r.created_at) = ? OR EXISTS (
        SELECT 1 FROM messages m 
        WHERE m.room_id = r.id AND DATE(m.created_at) = ?
      )
      ORDER BY (SELECT MAX(created_at) FROM messages WHERE room_id = r.id) DESC`,
      [today, today, today]
    );

    res.json({ rooms, date: today });
  } catch (error) {
    console.error('获取今日聊天室失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取指定房间的所有消息
router.get('/rooms/:roomId/messages', authenticateAdmin, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { date } = req.query;

    let sql = `
      SELECT m.*, 
        u.username as sender_username, 
        u.display_name as sender_name,
        r.type as room_type
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      INNER JOIN rooms r ON m.room_id = r.id
      WHERE m.room_id = ?
    `;

    const params = [roomId];

    if (date) {
      sql += ' AND DATE(m.created_at) = ?';
      params.push(date);
    }

    sql += ' ORDER BY m.created_at ASC';

    const messages = await database.allAsync(sql, params);

    res.json({ messages, roomId, date: date || 'all' });
  } catch (error) {
    console.error('获取消息失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 获取今日聊天统计
router.get('/stats/today', authenticateAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const stats = await database.getAsync(
      `SELECT 
        (SELECT COUNT(*) FROM messages WHERE DATE(created_at) = ?) as total_messages,
        (SELECT COUNT(*) FROM messages WHERE DATE(created_at) = ? AND type = 'text') as text_messages,
        (SELECT COUNT(*) FROM messages WHERE DATE(created_at) = ? AND type = 'image') as image_messages,
        (SELECT COUNT(DISTINCT room_id) FROM messages WHERE DATE(created_at) = ?) as active_rooms,
        (SELECT COUNT(DISTINCT sender_id) FROM messages WHERE DATE(created_at) = ?) as active_users,
        (SELECT COUNT(*) FROM users WHERE DATE(created_at) = ?) as new_users`,
      [today, today, today, today, today, today]
    );

    // 获取消息时段分布
    const hourlyDistribution = await database.allAsync(
      `SELECT 
        STRFTIME('%H', created_at) as hour,
        COUNT(*) as count
      FROM messages
      WHERE DATE(created_at) = ?
      GROUP BY STRFTIME('%H', created_at)
      ORDER BY hour`,
      [today]
    );

    res.json({
      date: today,
      stats,
      hourlyDistribution
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

// 搜索聊天记录
router.get('/search', authenticateAdmin, async (req, res) => {
  try {
    const { keyword, username, startDate, endDate, limit = 100 } = req.query;

    let sql = `
      SELECT m.*, 
        u.username as sender_username, 
        u.display_name as sender_name,
        r.type as room_type
      FROM messages m
      INNER JOIN users u ON m.sender_id = u.id
      INNER JOIN rooms r ON m.room_id = r.id
      WHERE 1=1
    `;

    const params = [];

    if (keyword) {
      sql += ' AND m.content LIKE ?';
      params.push(`%${keyword}%`);
    }

    if (username) {
      sql += ' AND u.username = ?';
      params.push(username);
    }

    if (startDate) {
      sql += ' AND DATE(m.created_at) >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND DATE(m.created_at) <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const messages = await database.allAsync(sql, params);

    res.json({ messages, count: messages.length });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ error: '搜索失败' });
  }
});

// 获取所有用户列表
router.get('/users', authenticateAdmin, async (req, res) => {
  try {
    const users = await database.allAsync(
      `SELECT id, username, display_name, status, last_seen, created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 100`
    );

    res.json({ users });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ error: '获取失败' });
  }
});

module.exports = router;
