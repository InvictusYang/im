const crypto = require('crypto');
const database = require('../database');

/**
 * 房间创建签名验证中间件
 * 用于验证商家后端的房间创建请求
 */

/**
 * 生成房间创建签名（商家后端使用）
 * @param {string} userId1 - 用户 1 ID
 * @param {string} userId2 - 用户 2 ID
 * @param {string} sharedSecret - 共享密钥
 * @returns {Object} 包含签名信息的对象
 */
function generateRoomSignature(userId1, userId2, sharedSecret) {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  // 生成签名数据
  const data = `${userId1}:${userId2}:${timestamp}:${nonce}`;
  const signature = crypto
    .createHmac('sha256', sharedSecret)
    .update(data)
    .digest('hex');
  
  return {
    userId1,
    userId2,
    timestamp,
    nonce,
    signature
  };
}

/**
 * 验证房间创建签名
 * @param {Object} req - Express 请求对象
 * @param {Object} res - Express 响应对象
 * @param {Function} next - 下一个中间件
 */
async function verifyRoomSignature(req, res, next) {
  try {
    const { userId1, userId2, timestamp, nonce, signature, merchantId } = req.body;
    
    // 1. 检查必填字段
    if (!userId1 || !userId2 || !timestamp || !nonce || !signature) {
      return res.status(400).json({ 
        error: '缺少必填字段：userId1, userId2, timestamp, nonce, signature' 
      });
    }
    
    // 2. 检查时间戳（5 分钟有效期）
    const now = Date.now();
    if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
      return res.status(400).json({ 
        error: '请求已过期，时间戳必须在 5 分钟内' 
      });
    }
    
    // 3. 检查 nonce 是否已使用（防止重放攻击）
    const existingNonce = await database.getAsync(
      'SELECT nonce FROM used_nonces WHERE nonce = ?',
      [nonce]
    );
    
    if (existingNonce) {
      return res.status(400).json({ 
        error: '重复的请求，nonce 已使用' 
      });
    }
    
    // 4. 获取商家密钥
    const merchantSecret = await database.getAsync(
      'SELECT secret_key FROM merchant_secrets WHERE merchant_id = ? AND is_active = 1',
      [merchantId]
    );
    
    if (!merchantSecret) {
      return res.status(403).json({ 
        error: '商家密钥不存在或已失效' 
      });
    }
    
    // 5. 验证签名
    const data = `${userId1}:${userId2}:${timestamp}:${nonce}`;
    const expectedSignature = crypto
      .createHmac('sha256', merchantSecret.secret_key)
      .update(data)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(403).json({ 
        error: '签名验证失败' 
      });
    }
    
    // 6. 标记 nonce 为已使用
    await database.runAsync(
      'INSERT INTO used_nonces (nonce) VALUES (?)',
      [nonce]
    );
    
    // 7. 清理旧的 nonce 记录（保留 24 小时）
    await database.runAsync(
      'DELETE FROM used_nonces WHERE used_at < datetime("now", "-24 hours")'
    );
    
    // 验证通过，继续处理
    next();
  } catch (error) {
    console.error('签名验证错误:', error);
    res.status(500).json({ error: '签名验证失败' });
  }
}

/**
 * 验证商家权限
 */
async function verifyMerchantAuth(req, res, next) {
  const jwt = require('jsonwebtoken');
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '未提供认证令牌' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 开发环境：允许所有用户
    // 生产环境：取消注释下面两行，限制只有商家和管理员
    // if (decoded.role !== 'merchant' && decoded.role !== 'admin') {
    //   return res.status(403).json({ error: '需要商家或管理员权限' });
    // }
    
    req.merchantId = decoded.userId;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    res.status(403).json({ error: '无效的认证令牌' });
  }
}

module.exports = {
  generateRoomSignature,
  verifyRoomSignature,
  verifyMerchantAuth
};
