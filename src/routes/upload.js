const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

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

// Multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_PATH || './uploads';
    cb(null, uploadDir + '/chat_images');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只支持图片文件 (JPEG, PNG, GIF, WebP)'));
    }
  }
});

// 上传图片
router.post('/image', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传图片' });
    }

    const originalPath = req.file.path;
    const compressedPath = originalPath.replace(/\.[^/.]+$/, '') + '_compressed.jpg';

    // 图片压缩（使用 sharp）
    await sharp(originalPath)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 75, progressive: true })
      .toFile(compressedPath);

    // 删除原图，保留压缩图
    fs.unlinkSync(originalPath);

    const imageUrl = `/uploads/chat_images/${path.basename(compressedPath)}`;

    res.json({
      message: '图片上传成功',
      url: imageUrl,
      size: req.file.size
    });
  } catch (error) {
    console.error('图片上传错误:', error);
    res.status(500).json({ error: '图片上传失败' });
  }
});

// 上传头像
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有上传头像' });
    }

    const originalPath = req.file.path;
    const compressedPath = originalPath.replace(/\.[^/.]+$/, '') + '_avatar.jpg';

    // 头像压缩（正方形，300x300）
    await sharp(originalPath)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toFile(compressedPath);

    // 删除原图
    fs.unlinkSync(originalPath);

    const avatarUrl = `/uploads/avatars/${path.basename(compressedPath)}`;

    // 更新用户头像
    require('../database').prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatarUrl, req.userId);

    res.json({
      message: '头像上传成功',
      avatar: avatarUrl
    });
  } catch (error) {
    console.error('头像上传错误:', error);
    res.status(500).json({ error: '头像上传失败' });
  }
});

// 错误处理
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: '文件大小不能超过 5MB' });
    }
    return res.status(400).json({ error: error.message });
  }
  next(error);
});

module.exports = router;
