/**
 * P2PChat SDK
 * 简单易用的 IM 客户端 SDK
 * 
 * 使用示例:
 * ```javascript
 * const p2pchat = new P2PChatSDK({
 *   serverUrl: 'https://im.yourmall.com',
 *   userId: 'user_123',
 *   token: 'jwt_token'
 * });
 * 
 * // 连接
 * await p2pchat.connect();
 * 
 * // 发送消息
 * p2pchat.sendMessage(roomId, 'Hello!');
 * 
 * // 监听消息
 * p2pchat.on('message', (msg) => {
 *   console.log('收到消息:', msg);
 * });
 * ```
 */

class P2PChatSDK {
  constructor(options) {
    // 环信兼容：appKey 映射为 serverUrl
    this.serverUrl = options.appKey || options.serverUrl;
    this.userId = options.userId;
    this.token = options.token;
    this.socket = null;
    this.listeners = {};
    this.currentRoom = null;
  }

  /**
   * 环信兼容：conn.open({ user, accessToken }) 等价于 connect()
   * @param {{ user: string, accessToken: string }} options
   */
  async open(options) {
    this.userId = options.user;
    this.token = options.accessToken;
    return this.connect();
  }

  /**
   * 环信兼容：addEventHandler('connection&message', { onConnected, onTextMessage, onError })
   * @param {string} name - 事件组名
   * @param {Object} handlers - 事件处理器
   */
  addEventHandler(name, handlers) {
    if (handlers.onConnected) this.on('onConnected', handlers.onConnected);
    if (handlers.onDisconnected) this.on('onDisconnected', handlers.onDisconnected);
    if (handlers.onTextMessage) this.on('onTextMessage', handlers.onTextMessage);
    if (handlers.onError) this.on('onError', handlers.onError);
    if (handlers.onMessage) this.on('message', handlers.onMessage);
  }

  /**
   * 连接到 IM 服务
   */
  async connect() {
    return new Promise((resolve, reject) => {
      // 动态加载 Socket.IO
      if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = `${this.serverUrl}/socket.io/socket.io.js`;
        script.onload = () => this._initSocket(resolve, reject);
        script.onerror = () => reject(new Error('Failed to load Socket.IO'));
        document.head.appendChild(script);
      } else {
        this._initSocket(resolve, reject);
      }
    });
  }

  _initSocket(resolve, reject) {
    this.socket = io(this.serverUrl, {
      auth: { token: this.token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      timeout: 20000
    });

    this.socket.on('connect', () => {
      console.log('[P2PChat] Connected');
      // 重连后重新认证
      this.socket.emit('authenticate', this.token);
      this._emit('onConnected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[P2PChat] Disconnected:', reason);
      this._emit('onDisconnected', { reason });
      // 如果是服务端断开(io server disconnect)，尝试重连
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[P2PChat] Reconnected after', attemptNumber, 'attempts');
      this._emit('reconnect', { attemptNumber });
    });

    this.socket.on('reconnect_error', (error) => {
      console.log('[P2PChat] Reconnect error:', error.message);
      this._emit('reconnectError', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[P2PChat] Reconnect failed');
      this._emit('reconnectFailed');
    });

    this.socket.on('authenticated', (data) => {
      console.log('[P2PChat] Authenticated');
      resolve(data);
    });

    this.socket.on('auth:error', (error) => {
      console.error('[P2PChat] Auth failed:', error);
      this._emit('onError', error);
      reject(new Error(error.error));
    });

    this.socket.on('message:new', (message) => {
      this._emit('message', message);
      this._emit('onTextMessage', message);   // 环信标准事件
    });

    this.socket.on('user:online', (data) => {
      this._emit('userOnline', data);
    });

    this.socket.on('user:offline', (data) => {
      this._emit('userOffline', data);
    });

    this.socket.on('room:created', (data) => {
      this._emit('roomCreated', data);
    });
  }

  /**
   * 商家创建房间（撮合两个用户）
   * @param {Object} options
   * @param {string} options.userId1 - 用户 1 ID
   * @param {string} options.userId2 - 用户 2 ID
   * @param {string} options.orderId - 订单号（可选）
   * @param {Object} options.metadata - 元数据（可选）
   * @param {string} options.signature - 签名（商家后端生成）
   * @param {number} options.timestamp - 时间戳
   * @param {string} options.nonce - 随机数
   * @returns {Promise<string>} - 房间 ID
   */
  async createRoom(options) {
    const { userId1, userId2, orderId, metadata, signature, timestamp, nonce } = options;

    const response = await fetch(`${this.serverUrl}/api/merchant/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        userId1,
        userId2,
        orderId,
        metadata,
        signature,
        timestamp,
        nonce
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || '创建房间失败');
    }

    const data = await response.json();
    return data.roomId;
  }

  /**
   * 监听新房间创建（用户端）
   * @param {Function} callback - 回调函数
   */
  onRoomCreated(callback) {
    this.on('room:created', (data) => {
      // 自动加入房间
      this.joinRoom(data.roomId);
      callback(data);
    });
  }

  /**
   * 环信兼容：conn.send(msg) 直接向目标用户发送消息
   * @param {{ type: string, to: string, msg: string }} msgObj - 环信风格消息对象
   *    type: 'txt' | 'img' | 'text' | 'image'
   *    to: 目标用户 ID
   *    msg: 消息内容
   */
  send(msgObj) {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    // 环信字段映射
    this.socket.emit('message:send:direct', {
      type: msgObj.type === 'txt' ? 'text' : (msgObj.type || 'text'),
      to: msgObj.to,
      content: msgObj.msg || msgObj.content
    });
  }

  /**
   * 发送消息（已有 roomId 的场景）
   * @param {string} roomId - 房间ID
   * @param {string} content - 消息内容
   * @param {Object} options - 可选参数 { type, orderId, fileUrl }
   */
  sendMessage(roomId, content, options = {}) {
    if (!this.socket) {
      throw new Error('Not connected');
    }

    const message = {
      roomId,
      type: options.type || 'text',
      content,
      orderId: options.orderId || null,
      fileUrl: options.fileUrl || null
    };

    this.socket.emit('message:send', message);
  }

  /**
   * 上传图片
   * @param {File} file - 图片文件
   * @returns {Promise<string>} - 图片URL
   */
  async uploadImage(file) {
    const formData = new FormData();
    formData.append('image', file);

    const response = await fetch(`${this.serverUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Upload failed');
    }

    const data = await response.json();
    return data.url;
  }

  /**
   * 发送图片消息（环信风格 type=img）
   * @param {string} roomId - 房间ID
   * @param {File} file - 图片文件
   * @param {Object} options - 可选参数 { orderId: '订单号' }
   */
  async sendImage(roomId, file, options = {}) {
    const fileUrl = await this.uploadImage(file);
    this.sendMessage(roomId, fileUrl, {
      ...options,
      type: 'img',
      fileUrl
    });
  }

  /**
   * 创建一对一聊天房间
   * @param {string} targetUserId - 目标用户ID
   */
  createDirectRoom(targetUserId) {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    this.socket.emit('room:create:direct', { targetUserId });
  }

  /**
   * 加入房间
   * @param {string} roomId - 房间ID
   */
  joinRoom(roomId) {
    if (!this.socket) {
      throw new Error('Not connected');
    }
    this.socket.emit('room:join', roomId);
    this.currentRoom = roomId;
  }

  /**
   * 获取房间消息
   * @param {string} roomId - 房间ID
   * @param {Object} options - 可选参数 { limit: 50, offset: 0 }
   * @returns {Promise<Array>} - 消息列表
   */
  async getMessages(roomId, options = {}) {
    const params = new URLSearchParams({
      limit: options.limit || 50,
      offset: options.offset || 0
    });

    const response = await fetch(
      `${this.serverUrl}/api/messages/rooms/${roomId}/messages?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }

    const data = await response.json();
    return data.messages;
  }

  /**
   * 获取用户的房间列表
   * @returns {Promise<Array>} - 房间列表
   */
  async getRooms() {
    const response = await fetch(`${this.serverUrl}/api/messages/rooms`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch rooms');
    }

    const data = await response.json();
    return data.rooms;
  }

  /**
   * 搜索消息
   * @param {string} keyword - 搜索关键词
   * @param {Object} options - 可选参数 { roomId, limit }
   * @returns {Promise<Array>} - 消息列表
   */
  async searchMessages(keyword, options = {}) {
    const params = new URLSearchParams({ q: keyword });
    if (options.roomId) params.append('roomId', options.roomId);
    if (options.limit) params.append('limit', options.limit);

    const response = await fetch(
      `${this.serverUrl}/api/messages/search?${params}`,
      {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const data = await response.json();
    return data.messages;
  }

  /**
   * 事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * 移除事件监听
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  /**
   * 触发事件
   * @private
   */
  _emit(event, data) {
    if (!this.listeners[event]) return;
    this.listeners[event].forEach(callback => callback(data));
  }

  /**
   * 断开连接
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = P2PChatSDK;
}

if (typeof window !== 'undefined') {
  window.P2PChatSDK = P2PChatSDK;
}
