const express = require('express');
const router = express.Router();
const database = require('../database');
const { verifyRoomSignature, verifyMerchantAuth } = require('../middleware/roomAuth');
const { v4: uuidv4 } = require('uuid');

// 获取 Socket.IO 实例（从 server.js 导出）
let io;
function setIO(ioInstance) {
  io = ioInstance;
}

/**
 * 商家创建房间
 * POST /api/merchant/rooms/create
 * 
 * 请求体：
 * {
 *   "userId1": "user_123",
 *   "userId2": "user_456",
 *   "orderId": "ORDER_001",        // 可选
 *   "metadata": {},                 // 可选
 *   "timestamp": 1234567890,
 *   "nonce": "abc123",
 *   "signature": "xyz789",
 *   "merchantId": "merchant_001"
 * }
 */
router.post('/create', verifyMerchantAuth, verifyRoomSignature, async (req, res) => {
  try {
    const { userId1, userId2, orderId, metadata } = req.body;
    const merchantId = req.merchantId;
    
    // 0. 强制校验 orderId 必填，避免 NULL 房间无法复用导致数据库膨胀
    if (!orderId || typeof orderId !== 'string' || !orderId.trim()) {
      return res.status(400).json({ error: 'orderId 必填，需为非空字符串' });
    }
    
    // 1. 检查两个用户是否存在（支持用户名或 ID）
    let user1, user2;
    
    // 检查 userId1 是 ID 还是用户名
    if (userId1.includes('-')) {
      // UUID 格式，按 ID 查
      user1 = await database.getAsync('SELECT id FROM users WHERE id = ?', [userId1]);
    } else {
      // 用户名格式，按 username 查
      user1 = await database.getAsync('SELECT id FROM users WHERE username = ?', [userId1]);
    }
    
    // 检查 userId2 是 ID 还是用户名
    if (userId2.includes('-')) {
      user2 = await database.getAsync('SELECT id FROM users WHERE id = ?', [userId2]);
    } else {
      user2 = await database.getAsync('SELECT id FROM users WHERE username = ?', [userId2]);
    }
    
    if (!user1 || !user2) {
      return res.status(400).json({ error: '用户不存在' });
    }
    
    // 统一使用 ID
    const userId1Final = user1.id;
    const userId2Final = user2.id;
    
    // 2. 检查是否已有房间
    const existingRoom = await database.getAsync(`
      SELECT r.id FROM rooms r
      INNER JOIN room_members rm1 ON r.id = rm1.room_id AND rm1.user_id = ?
      INNER JOIN room_members rm2 ON r.id = rm2.room_id AND rm2.user_id = ?
      WHERE r.type = 'direct' 
        AND r.order_id = ?
        AND r.is_active = 1
      LIMIT 1
    `, [userId1Final, userId2Final, orderId]);
    
    if (existingRoom) {
      return res.json({
        roomId: existingRoom.id,
        message: '房间已存在',
        isNew: false
      });
    }
    
    // 3. 创建房间
    const roomId = uuidv4();
    await database.runAsync(
      `INSERT INTO rooms (id, type, created_by, order_id, metadata, is_active) 
       VALUES (?, 'direct', ?, ?, ?, 1)`,
      [roomId, merchantId, orderId, JSON.stringify(metadata || {})]
    );
    
    // 4. 添加成员（两个用户）
    await database.runAsync(
      'INSERT OR IGNORE INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
      [roomId, userId1Final, 'member']
    );
    
    await database.runAsync(
      'INSERT OR IGNORE INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
      [roomId, userId2Final, 'member']
    );
    
    // 5. 通过 Socket.IO 通知两个用户（如果在线）
    if (io) {
      io.to(userId1Final).emit('room:created', { roomId, orderId, isNew: true });
      io.to(userId2Final).emit('room:created', { roomId, orderId, isNew: true });
      console.log(`🔔 房间创建通知: ${roomId} -> 用户 ${userId1Final}, ${userId2Final}`);
    }
    
    // 5. 获取创建的房间信息
    const room = await database.getAsync('SELECT * FROM rooms WHERE id = ?', [roomId]);
    
    res.json({
      roomId,
      room,
      isNew: true,
      message: '房间创建成功'
    });
  } catch (error) {
    console.error('创建房间错误:', error);
    res.status(500).json({ error: '创建房间失败' });
  }
});

/**
 * 商家生成密钥
 * POST /api/merchant/keys/generate
 */
router.post('/keys/generate', verifyMerchantAuth, async (req, res) => {
  try {
    const crypto = require('crypto');
    const merchantId = req.merchantId;
    
    // 生成密钥
    const secretKey = crypto.randomBytes(32).toString('hex');
    const keyId = uuidv4();
    
    // 保存密钥
    await database.runAsync(
      'INSERT INTO merchant_secrets (id, merchant_id, secret_key) VALUES (?, ?, ?)',
      [keyId, merchantId, secretKey]
    );
    
    res.json({
      keyId,
      secretKey,
      message: '密钥生成成功，请妥善保存'
    });
  } catch (error) {
    console.error('生成密钥错误:', error);
    res.status(500).json({ error: '生成密钥失败' });
  }
});

/**
 * 获取商家的房间列表
 * GET /api/merchant/rooms?limit=50&offset=0
 */
router.get('/rooms', verifyMerchantAuth, async (req, res) => {
  try {
    const merchantId = req.merchantId;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const rooms = await database.allAsync(`
      SELECT r.*, 
             COUNT(DISTINCT rm.user_id) as member_count,
             (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id) as message_count
      FROM rooms r
      LEFT JOIN room_members rm ON r.id = rm.room_id
      WHERE r.created_by = ? AND r.is_active = 1
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [merchantId, limit, offset]);
    
    res.json({
      rooms,
      total: rooms.length,
      limit,
      offset
    });
  } catch (error) {
    console.error('获取房间列表错误:', error);
    res.status(500).json({ error: '获取房间列表失败' });
  }
});

/**
 * 生成签名示例（开发测试用）
 * POST /api/merchant/signature/example
 */
router.post('/signature/example', verifyMerchantAuth, async (req, res) => {
  try {
    const { userId1, userId2 } = req.body;
    
    // 获取商家的第一个密钥
    const merchantSecret = await database.getAsync(
      'SELECT secret_key FROM merchant_secrets WHERE merchant_id = ? AND is_active = 1 LIMIT 1',
      [req.merchantId]
    );
    
    if (!merchantSecret) {
      return res.status(400).json({ 
        error: '请先生成密钥',
        action: '调用 POST /api/merchant/keys/generate'
      });
    }
    
    const { generateRoomSignature } = require('../middleware/roomAuth');
    const signature = generateRoomSignature(userId1, userId2, merchantSecret.secret_key);
    
    res.json({
      ...signature,
      merchantId: req.merchantId,
      message: '使用此签名创建房间'
    });
  } catch (error) {
    console.error('生成签名示例错误:', error);
    res.status(500).json({ error: '生成签名失败' });
  }
});

module.exports = router;
