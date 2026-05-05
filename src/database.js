const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class ChatDatabase {
  constructor() {
    this.db = null;
  }

  initialize() {
    const dbPath = process.env.DB_PATH || './data/chat.db';
    const dbDir = path.dirname(dbPath);

    // 确保数据库目录存在
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    console.log(`📦 初始化数据库: ${dbPath}`);

    // 创建数据库连接
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ 数据库连接失败:', err);
        throw err;
      }
    });

    // 启用 WAL 模式（提升并发性能）
    this.runAsync('PRAGMA journal_mode = WAL');
    this.runAsync('PRAGMA synchronous = NORMAL');
    this.runAsync('PRAGMA cache_size = -64000'); // 64MB 缓存
    this.runAsync('PRAGMA temp_store = MEMORY');
    this.runAsync('PRAGMA foreign_keys = ON');

    console.log('✅ WAL 模式已启用');

    // 创建表和索引（按顺序）
    this.createTables().then(() => {
      this.createIndexes();
    });

    // 启动定时 WAL checkpoint（每 60 秒将 WAL 归并到主数据库文件，降低崩溃丢失风险）
    this.startCheckpointTimer();

    console.log('✅ 数据库初始化完成');
  }

  // 定时执行 WAL checkpoint，将 WAL 文件内容写入主 db 并截断
  startCheckpointTimer() {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
    }
    this.checkpointTimer = setInterval(() => {
      this.runAsync('PRAGMA wal_checkpoint(TRUNCATE)')
        .then(() => {
          console.log('💾 WAL checkpoint 成功');
        })
        .catch(err => {
          console.error('❌ WAL checkpoint 失败:', err);
        });
    }, 60 * 1000);
  }

  runAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  getAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  allAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  createTables() {
    const tables = [
      // 用户表
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        avatar TEXT,
        status TEXT DEFAULT 'offline',
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 房间表
      `CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK(type IN ('direct', 'group')),
        name TEXT,
        description TEXT,
        avatar TEXT,
        created_by TEXT,
        order_id TEXT,                      -- 关联订单号
        metadata TEXT,                      -- JSON 元数据
        is_active INTEGER DEFAULT 1,        -- 是否活跃
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )`,

      // 房间成员表
      `CREATE TABLE IF NOT EXISTS room_members (
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member' CHECK(role IN ('creator', 'admin', 'member')),
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_read_at DATETIME,              -- 最后阅读时间
        PRIMARY KEY (room_id, user_id),
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`,

      // 消息表
      `CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        type TEXT DEFAULT 'text' CHECK(type IN ('text', 'image', 'file', 'system')),
        content TEXT NOT NULL,
        file_url TEXT,
        order_id TEXT,
        is_deleted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )`,

      // 商家密钥表（新增）
      `CREATE TABLE IF NOT EXISTS merchant_secrets (
        id TEXT PRIMARY KEY,
        merchant_id TEXT NOT NULL,
        secret_key TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (merchant_id) REFERENCES users(id)
      )`,

      // Nonce 记录表（防止重放攻击）
      `CREATE TABLE IF NOT EXISTS used_nonces (
        nonce TEXT PRIMARY KEY,
        used_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // 消息已读状态表
      `CREATE TABLE IF NOT EXISTS message_reads (
        message_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (message_id, user_id),
        FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )`
    ];

    let chain = Promise.resolve();
    tables.forEach(sql => {
      chain = chain.then(() => this.runAsync(sql));
    });

    return chain.then(() => {
      console.log('✅ 数据表创建完成');
    }).catch(err => {
      console.error('❌ 数据表创建失败:', err);
    });
  }

  createIndexes() {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`,
      `CREATE INDEX IF NOT EXISTS idx_room_members_user ON room_members(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(room_id, created_at DESC) WHERE is_deleted = 0`,
      `CREATE INDEX IF NOT EXISTS idx_rooms_order_id ON rooms(order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_order ON messages(order_id)`,
      `CREATE INDEX IF NOT EXISTS idx_merchant_secrets_merchant ON merchant_secrets(merchant_id)`,
      `CREATE INDEX IF NOT EXISTS idx_used_nonces_used_at ON used_nonces(used_at)`
    ];

    let chain = Promise.resolve();
    indexes.forEach(sql => {
      chain = chain.then(() => this.runAsync(sql));
    });

    chain.then(() => {
      console.log('✅ 索引创建完成');
    }).catch(err => {
      console.error('❌ 索引创建失败:', err);
    });
  }

  // 关闭数据库
  close() {
    if (this.checkpointTimer) {
      clearInterval(this.checkpointTimer);
      this.checkpointTimer = null;
    }
    if (this.db) {
      // 关闭前执行一次 checkpoint，确保 WAL 全部落盘
      this.runAsync('PRAGMA wal_checkpoint(TRUNCATE)').catch(() => {}).finally(() => {
        this.db.close(() => {
          console.log('📦 数据库已关闭');
        });
      });
    }
  }

  getInstance() {
    return this.db;
  }
}

// 单例模式
const database = new ChatDatabase();

module.exports = database;
