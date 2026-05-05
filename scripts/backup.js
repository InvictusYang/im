#!/usr/bin/env node

/**
 * P2PChat 数据备份脚本
 * 功能：
 * 1. 定时备份 SQLite 数据库
 * 2. 归档旧聊天记录
 * 3. 生成备份报告
 * 
 * 使用方式：
 * - 手动执行：node scripts/backup.js
 * - 定时执行：crontab -e 添加 0 2 * * * cd /opt/p2pchat && node scripts/backup.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 配置
const config = {
  dbPath: process.env.DB_PATH || './data/chat.db',
  backupDir: process.env.BACKUP_DIR || './data/backups',
  archiveDir: process.env.ARCHIVE_DIR || './data/archives',
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30, // 保留天数
  archiveDays: parseInt(process.env.ARCHIVE_DAYS) || 90 // 归档天数
};

// 确保目录存在
[config.backupDir, config.archiveDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// 生成时间戳
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const today = new Date().toISOString().split('T')[0];

console.log(`📦 开始备份 P2PChat 数据...`);
console.log(`📅 日期: ${today}`);
console.log(`💾 数据库: ${config.dbPath}`);

// 1. 备份数据库
function backupDatabase() {
  console.log('\n📋 步骤 1: 备份数据库');
  
  const backupFile = path.join(config.backupDir, `chat_${timestamp}.db`);
  
  try {
    // 使用 SQLite 的 backup API
    const sqlite3 = require('sqlite3').verbose();
    const source = new sqlite3.Database(config.dbPath);
    const dest = new sqlite3.Database(backupFile);
    
    source.backup(dest, (err) => {
      if (err) {
        console.error('❌ 数据库备份失败:', err);
        process.exit(1);
      }
      
      dest.close();
      source.close();
      
      const stats = fs.statSync(backupFile);
      const size = (stats.size / 1024 / 1024).toFixed(2);
      
      console.log(`✅ 数据库备份成功: ${backupFile}`);
      console.log(`📊 大小: ${size} MB`);
      
      // 创建备份元数据
      const metadata = {
        timestamp: new Date().toISOString(),
        file: backupFile,
        size: stats.size,
        sizeMB: size,
        tables: ['users', 'rooms', 'room_members', 'messages', 'message_reads']
      };
      
      fs.writeFileSync(
        backupFile.replace('.db', '_metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
    });
  } catch (error) {
    console.error('❌ 数据库备份失败:', error);
  }
}

// 2. 归档旧聊天记录
function archiveOldMessages() {
  console.log('\n📋 步骤 2: 归档旧聊天记录');
  
  const archiveDate = new Date();
  archiveDate.setDate(archiveDate.getDate() - config.archiveDays);
  const archiveDateStr = archiveDate.toISOString().split('T')[0];
  
  const sqlite3 = require('sqlite3').verbose();
  const db = new sqlite3.Database(config.dbPath);
  
  // 查询要归档的消息数量
  db.get(
    'SELECT COUNT(*) as count FROM messages WHERE created_at < ?',
    [archiveDateStr],
    (err, row) => {
      if (err) {
        console.error('❌ 查询失败:', err);
        return;
      }
      
      console.log(`📊 待归档消息数: ${row.count}`);
      
      if (row.count === 0) {
        console.log('✅ 没有需要归档的消息');
        db.close();
        return;
      }
      
      // 导出归档数据
      const archiveFile = path.join(config.archiveDir, `messages_before_${archiveDateStr}.json`);
      
      db.all(
        `SELECT m.*, u.username as sender_username, u.display_name as sender_name
         FROM messages m
         INNER JOIN users u ON m.sender_id = u.id
         WHERE m.created_at < ?
         ORDER BY m.created_at ASC`,
        [archiveDateStr],
        (err, messages) => {
          if (err) {
            console.error('❌ 导出失败:', err);
            db.close();
            return;
          }
          
          // 保存归档文件
          fs.writeFileSync(archiveFile, JSON.stringify(messages, null, 2));
          
          const stats = fs.statSync(archiveFile);
          const size = (stats.size / 1024 / 1024).toFixed(2);
          
          console.log(`✅ 归档成功: ${archiveFile}`);
          console.log(`📊 归档消息数: ${messages.length}`);
          console.log(`📊 大小: ${size} MB`);
          
          // 可选：删除已归档的消息（释放空间）
          // db.run('DELETE FROM messages WHERE created_at < ?', [archiveDateStr]);
          
          db.close();
        }
      );
    }
  );
}

// 3. 清理旧备份
function cleanupOldBackups() {
  console.log('\n📋 步骤 3: 清理旧备份');
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - config.retentionDays);
  
  const files = fs.readdirSync(config.backupDir);
  let deletedCount = 0;
  
  files.forEach(file => {
    if (!file.endsWith('.db')) return;
    
    const filePath = path.join(config.backupDir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.mtime < cutoffDate) {
      fs.unlinkSync(filePath);
      
      // 同时删除元数据文件
      const metaFile = filePath.replace('.db', '_metadata.json');
      if (fs.existsSync(metaFile)) {
        fs.unlinkSync(metaFile);
      }
      
      deletedCount++;
      console.log(`🗑️  删除旧备份: ${file}`);
    }
  });
  
  console.log(`✅ 清理完成，删除 ${deletedCount} 个旧备份`);
}

// 4. 生成备份报告
function generateReport() {
  console.log('\n📋 步骤 4: 生成备份报告');
  
  const backupFiles = fs.readdirSync(config.backupDir)
    .filter(f => f.endsWith('.db'))
    .map(f => {
      const filePath = path.join(config.backupDir, f);
      const stats = fs.statSync(filePath);
      return {
        file: f,
        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
        date: stats.mtime.toISOString()
      };
    });
  
  const archiveFiles = fs.readdirSync(config.archiveDir)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const filePath = path.join(config.archiveDir, f);
      const stats = fs.statSync(filePath);
      return {
        file: f,
        size: (stats.size / 1024 / 1024).toFixed(2) + ' MB',
        date: stats.mtime.toISOString()
      };
    });
  
  const report = {
    backupDate: new Date().toISOString(),
    database: {
      path: config.dbPath,
      size: (fs.statSync(config.dbPath).size / 1024 / 1024).toFixed(2) + ' MB'
    },
    backups: backupFiles,
    archives: archiveFiles,
    stats: {
      totalBackups: backupFiles.length,
      totalArchives: archiveFiles.length,
      retentionDays: config.retentionDays,
      archiveDays: config.archiveDays
    }
  };
  
  const reportFile = path.join(config.backupDir, `backup_report_${today}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  
  console.log(`✅ 备份报告已生成: ${reportFile}`);
  console.log(`\n📊 备份统计:`);
  console.log(`   - 备份文件数: ${backupFiles.length}`);
  console.log(`   - 归档文件数: ${archiveFiles.length}`);
  console.log(`   - 保留天数: ${config.retentionDays}`);
}

// 执行备份
try {
  backupDatabase();
  
  setTimeout(() => {
    archiveOldMessages();
    
    setTimeout(() => {
      cleanupOldBackups();
      generateReport();
      
      console.log('\n🎉 备份完成！');
    }, 1000);
  }, 1000);
} catch (error) {
  console.error('❌ 备份失败:', error);
  process.exit(1);
}
