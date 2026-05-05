/**
 * 商家后端集成示例
 * 演示如何生成签名并创建房间
 */

const crypto = require('crypto');

class MerchantIMService {
  /**
   * @param {string} p2pchatUrl - P2PChat 服务地址
   * @param {string} merchantToken - 商家 JWT Token
   * @param {string} secretKey - 商家密钥（从 P2PChat 获取）
   */
  constructor(p2pchatUrl, merchantToken, secretKey) {
    this.p2pchatUrl = p2pchatUrl;
    this.merchantToken = merchantToken;
    this.secretKey = secretKey;
  }

  /**
   * 生成房间创建签名
   * @param {string} userId1 - 用户 1 ID
   * @param {string} userId2 - 用户 2 ID
   * @returns {Object} 签名信息
   */
  generateRoomSignature(userId1, userId2) {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // 生成签名数据
    const data = `${userId1}:${userId2}:${timestamp}:${nonce}`;
    const signature = crypto
      .createHmac('sha256', this.secretKey)
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
   * 创建聊天房间（撮合两个用户）
   * @param {string} userId1 - 买家 ID
   * @param {string} userId2 - 卖家 ID
   * @param {Object} options - 可选参数
   * @param {string} options.orderId - 订单号
   * @param {Object} options.metadata - 元数据
   * @returns {Promise<Object>} 房间信息
   */
  async createChatRoom(userId1, userId2, options = {}) {
    const { orderId, metadata } = options;
    
    // 1. 生成签名
    const signatureData = this.generateRoomSignature(userId1, userId2);
    
    // 2. 创建房间
    const response = await fetch(`${this.p2pchatUrl}/api/merchant/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.merchantToken}`
      },
      body: JSON.stringify({
        ...signatureData,
        orderId: orderId || null,
        metadata: metadata || {}
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建房间失败');
    }

    return await response.json();
  }

  /**
   * 获取商家密钥（首次使用）
   * @returns {Promise<Object>} 密钥信息
   */
  async generateKey() {
    const response = await fetch(`${this.p2pchatUrl}/api/merchant/keys/generate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.merchantToken}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '生成密钥失败');
    }

    return await response.json();
  }

  /**
   * 获取签名示例（开发测试用）
   * @param {string} userId1 - 用户 1
   * @param {string} userId2 - 用户 2
   * @returns {Promise<Object>} 签名示例
   */
  async getSignatureExample(userId1, userId2) {
    const response = await fetch(`${this.p2pchatUrl}/api/merchant/signature/example`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.merchantToken}`
      },
      body: JSON.stringify({ userId1, userId2 })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '获取签名示例失败');
    }

    return await response.json();
  }

  /**
   * 获取商家的房间列表
   * @param {Object} options - 分页参数
   * @param {number} options.limit - 每页数量
   * @param {number} options.offset - 偏移量
   * @returns {Promise<Object>} 房间列表
   */
  async getRooms(options = {}) {
    const { limit = 50, offset = 0 } = options;
    
    const response = await fetch(
      `${this.p2pchatUrl}/api/merchant/rooms?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${this.merchantToken}`
        }
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '获取房间列表失败');
    }

    return await response.json();
  }
}

// ==================== 使用示例 ====================

/**
 * 示例 1：首次使用 - 生成密钥
 */
async function example1_GenerateKey() {
  const service = new MerchantIMService(
    'https://im.yourmall.com',
    'your_merchant_jwt_token',
    null  // 首次使用不需要密钥
  );

  try {
    const keyData = await service.generateKey();
    console.log('✅ 密钥生成成功！');
    console.log('Key ID:', keyData.keyId);
    console.log('Secret Key:', keyData.secretKey);
    console.log('⚠️  请妥善保存密钥，不要泄露！');
  } catch (error) {
    console.error('❌ 生成密钥失败:', error.message);
  }
}

/**
 * 示例 2：创建聊天房间
 */
async function example2_CreateRoom() {
  const service = new MerchantIMService(
    'https://im.yourmall.com',
    'your_merchant_jwt_token',
    'your_secret_key_here'  // 从示例 1 获取
  );

  try {
    const result = await service.createChatRoom(
      'buyer_123',      // 买家 ID
      'seller_456',     // 卖家 ID
      {
        orderId: 'ORDER_20240101_001',
        metadata: {
          productName: 'iPhone 15 Pro',
          orderAmount: 7999,
          customerService: '客服小王'
        }
      }
    );

    console.log('✅ 房间创建成功！');
    console.log('Room ID:', result.roomId);
    console.log('是否新房间:', result.isNew);
  } catch (error) {
    console.error('❌ 创建房间失败:', error.message);
  }
}

/**
 * 示例 3：获取房间列表
 */
async function example3_GetRooms() {
  const service = new MerchantIMService(
    'https://im.yourmall.com',
    'your_merchant_jwt_token',
    'your_secret_key_here'
  );

  try {
    const rooms = await service.getRooms({ limit: 20, offset: 0 });
    console.log('✅ 获取房间列表成功！');
    console.log('房间数量:', rooms.total);
    console.log('房间列表:', rooms.rooms);
  } catch (error) {
    console.error('❌ 获取房间列表失败:', error.message);
  }
}

/**
 * 示例 4：在订单处理流程中自动创建聊天室
 */
async function example4_OrderWorkflow() {
  const service = new MerchantIMService(
    'https://im.yourmall.com',
    'your_merchant_jwt_token',
    'your_secret_key_here'
  );

  // 模拟订单处理流程
  const order = {
    id: 'ORDER_20240101_002',
    buyerId: 'buyer_789',
    sellerId: 'seller_012',
    product: 'MacBook Pro',
    amount: 14999
  };

  try {
    // 订单创建成功后，自动创建聊天室
    console.log('📦 订单创建成功，正在创建聊天室...');
    
    const room = await service.createChatRoom(
      order.buyerId,
      order.sellerId,
      {
        orderId: order.id,
        metadata: {
          productName: order.product,
          orderAmount: order.amount,
          createdAt: new Date().toISOString()
        }
      }
    );

    console.log('✅ 聊天室创建成功！');
    console.log('Room ID:', room.roomId);
    console.log('订单号:', order.id);
    console.log('买卖双方可以开始沟通了！');

    // 可以通过 WebSocket 通知双方
    // io.to(order.buyerId).emit('room:created', { roomId: room.roomId });
    // io.to(order.sellerId).emit('room:created', { roomId: room.roomId });

  } catch (error) {
    console.error('❌ 创建聊天室失败:', error.message);
  }
}

// 导出供其他模块使用
module.exports = MerchantIMService;

// 如果直接运行此文件，执行示例
if (require.main === module) {
  console.log('=== P2PChat 商家后端集成示例 ===\n');
  console.log('请选择要运行的示例：\n');
  console.log('1. 生成密钥');
  console.log('2. 创建聊天房间');
  console.log('3. 获取房间列表');
  console.log('4. 订单工作流示例\n');
  console.log('⚠️  请先修改代码中的配置信息再运行！');
}
