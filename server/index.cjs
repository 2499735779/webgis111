const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const https = require('https');    // 使用 https 模块
const fs = require('fs');          // 用于读取证书和私钥文件
const { Server } = require('socket.io');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: './cos.env', override: true });
const COS = require('cos-nodejs-sdk-v5');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));
app.use('/avatars', express.static(path.join(__dirname, '../public/avatars'))); // 新增：托管静态头像资源

// 读取项目根目录 ssl 文件夹下的证书和私钥
const options = {
  key: fs.readFileSync('./ssl/privatekey.pem'),
  cert: fs.readFileSync('./ssl/certificate.pem')
};

const uri = "mongodb+srv://cstgkangrui:Cu4RV8xkbdjpl6gK@webgis0.tszfumn.mongodb.net/?retryWrites=true&w=majority&appName=webgis0";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

// 配置腾讯云 COS
const cos = new COS({
  SecretId: process.env.TENCENT_COS_SECRET_ID,
  SecretKey: process.env.TENCENT_COS_SECRET_KEY,
});

// 存储桶配置
const BUCKET_NAME = 'user-avatars-1377740210';
const REGION = 'ap-guangzhou';

// 使用 HTTPS 创建服务器，并经过 Socket.IO 包装实现 WebSocket 通信
const server = https.createServer(options, app);
const io = new Server(server, {
  cors: {
    origin: "*",  // 生产环境建议根据实际情况设置允许的跨域源
    methods: ["GET", "POST"]
  }
});

// Socket.IO 连接处理
io.on('connection', (socket) => {
  console.log("New client connected:", socket.id);

  // 客户端完成身份验证后，将自身加入以用户名命名的房间
  socket.on('join', (username) => {
    socket.join(username);
    console.log(`Socket ${socket.id} joined room ${username}`);
  });
  // 新增：监听前端发来的 "clear-friend-tip" 事件
  socket.on('clear-friend-tip', async (data) => {
    const { username } = data;
    if (!username) return;
    try {
      // 将该用户收到的所有未读好友请求标记为已读
      await db.collection('messages').updateMany(
        { to: username, type: 'friend-request', read: false },
        { $set: { read: true } }
      );
      console.log(`Cleared friend tip for user ${username}`);
      
      // 更新未读消息统计并通知用户
      const updatedUnreadMap = await computeUnreadMapForUser(username);
      io.to(username).emit('unread-updated', updatedUnreadMap);
    } catch (err) {
      console.error("Error clearing friend tip for user", username, err);
    }
  });
  
  // 新增：删除好友后通知对方
  socket.on('friend-removed', ({ from, to }) => {
    // 通知对方好友关系被解除
    io.to(to).emit('friend-removed-notice', { from });
  });

  // 监听前端主动清除好友列表红点事件
  socket.on('friend-list-events-read', (data) => {
    const { username } = data || {};
    if (!username) return;
    // 通知该用户所有客户端清除红点
    io.to(username).emit('friend-list-events-read');
  });

  socket.on('disconnect', () => {
    console.log("Client disconnected:", socket.id);
  });
});

client.connect().then(async () => {
  db = client.db('webgis0');
  // 只建一次唯一索引
  await db.collection('userLocations').createIndex({ username: 1 }, { unique: true });
  console.log('Connected to MongoDB Atlas');

  // 定义 computeUnreadMapForUser 函数，用于计算某个用户的未读消息映射
  const computeUnreadMapForUser = async (username) => {
    if (!username) return {};
    const msgs = await db.collection('messages').aggregate([
      { $match: { to: username, read: false } },
      { $group: { _id: '$from', count: { $sum: 1 } } }
    ]).toArray();
    const result = {};
    msgs.forEach(m => { result[m._id] = m.count; });
    return result;
  };

  // 用户注册 - 修改用户名验证规则
  app.post('/api/user-register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ success: false, message: '账号和密码不能为空' });

    // 修改用户名格式验证（允许汉字、字母、数字，3-20个字符）
    if (username.length < 3 || username.length > 20) {
      return res.json({ success: false, message: '用户名长度为3-20个字符' });
    }
    
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9]+$/.test(username)) {
      return res.json({ success: false, message: '用户名只能包含汉字、字母、数字' });
    }

    const userCol = db.collection('users');
    const exist = await userCol.findOne({ username });
    if (exist) return res.json({ success: false, message: '注册失败！账号已存在' });
    await userCol.insertOne({ username, password });
    res.json({ success: true });
  });

  app.post('/api/user-login', async (req, res) => {
    try {
      console.log("收到 POST /api/user-login 请求, req.body:", req.body);
      const { username, password } = req.body;
      const userCol = db.collection('users');
      const user = await userCol.findOne({ username, password });
      if (!user) {
        console.log("用户未找到:", username);
        return res.json({ success: false, message: '账号或密码错误' });
      }
      res.json({ success: true, user: { username: user.username } });
    } catch (err) {
      console.error("Error in /api/user-login:", err);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  });

  app.get('/api/user-login', (req, res) => {
    res.json({ message: "This endpoint requires a POST request." });
  });

  // 用户头像上传/更换
app.post('/api/user-avatar', async (req, res) => {
  const { username, avatar } = req.body;
  console.log('[user-avatar] 请求参数:', { username, avatarType: typeof avatar, avatarLen: avatar ? avatar.length : 0 });
  if (!username || !avatar) {
    return res.status(400).json({ success: false, message: '用户名或头像数据缺失' });
  }

  let avatarUrl = avatar;
  if (avatar.startsWith('data:image/')) {
    // 提取 Base64 数据
    const base64Data = avatar.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const fileExtension = avatar.match(/^data:image\/(\w+);base64,/)[1] || 'png';
    const fileName = `avatars/${username}-${Date.now()}.${fileExtension}`;

    try {
      // 上传到腾讯云 COS
      const result = await cos.putObject({
        Bucket: BUCKET_NAME,
        Region: REGION,
        Key: fileName,
        Body: buffer,
        ContentType: `image/${fileExtension}`,
        ACL: 'public-read', // 设置文件为公开可读
      });
      console.log('[user-avatar] 腾讯云上传结果:', result);

      // 获取文件的访问 URL
      avatarUrl = `https://${result.Location}`;
    } catch (err) {
      console.error('[user-avatar] 上传到腾讯云失败:', err);
      return res.status(500).json({ success: false, message: '上传头像失败，请稍后重试' });
    }
  }

  // 更新数据库中的头像 URL
  try {
    const userCol = db.collection('users');
    await userCol.updateOne({ username }, { $set: { avatar: avatarUrl } });
    res.json({ success: true, avatar: avatarUrl });
  } catch (err) {
    console.error('[user-avatar] 更新数据库失败:', err);
    res.status(500).json({ success: false, message: '更新头像信息失败' });
  }
});

  // 保存或更新用户坐标
  app.post('/api/user-location', async (req, res) => {
    const { username, avatar, lng, lat } = req.body;
    if (!username || !lng || !lat) return res.json({ success: false, message: '参数缺失' });
    await db.collection('userLocations').updateOne(
      { username },
      {
        $set: {
          username,
          avatar,
          lng,
          lat,
          updatedAt: new Date(),
          location: { type: "Point", coordinates: [Number(lng), Number(lat)] }
        }
      },
      { upsert: true }
    );
    res.json({ success: true });
  });

  // 获取所有用户坐标
  app.get('/api/user-location', async (req, res) => {
    const users = await db.collection('userLocations').find().toArray();
    res.json(users);
  });

  // 搜索附近用户（3km内，带头像）
  app.get('/api/nearby-users', async (req, res) => {
    const { lng, lat, radius } = req.query;
    if (!lng || !lat) return res.json([]);
    const center = [Number(lng), Number(lat)];
    const r = Number(radius) || 3000;
    const users = await db.collection('userLocations').find({
      location: {
        $nearSphere: {
          $geometry: { type: "Point", coordinates: center },
          $maxDistance: r
        }
      }
    }, {
      projection: { username: 1, lng: 1, lat: 1, avatar: 1 }
    }).limit(100).toArray();
    res.json(users);
  });

  // 获取用户好友列表
  app.get('/api/user-friends', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    const userCol = db.collection('users');
    const userDoc = await userCol.findOne({ username });
    res.json(userDoc && userDoc.friends ? userDoc.friends : []);
  });

  // 批量获取用户信息（只返回必要字段，头像缩略图）
  app.post('/api/user-info-batch', async (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) return res.json([]);
    const userCol = db.collection('users');
    const users = await userCol.find({ username: { $in: usernames } }).toArray();
    res.json(users.map(u => ({
      username: u.username,
      avatar: u.avatarThumb || u.avatar || '', // 优先返回缩略图URL
      gameTags: u.gameTags || []
    })));
  });

  // 发送消息接口（普通消息或好友请求）
  // 需要为每条消息存储两份(owner: from 和 owner: to)，以便各自独立删除
  app.post('/api/messages', async (req, res) => {
    const { from, to, content, type } = req.body;
    if (!from || !to || !content)
      return res.json({ success: false, message: '参数缺失' });
    const msgFrom = {
      from,
      to,
      content,
      type: type || 'chat',
      read: true, // 发消息一方始终已读
      createdAt: new Date(),
      owner: from
    };
    const msgTo = {
      from,
      to,
      content,
      type: type || 'chat',
      read: false, // 接收方未读
      createdAt: new Date(),
      owner: to
    };
    await db.collection('messages').insertMany([msgFrom, msgTo]);
    io.to(to).emit('chat-message', msgTo);
    // 计算最新的未读消息状态并推送给目标用户
    const updatedUnreadMap = await computeUnreadMapForUser(to);
    io.to(to).emit('unread-updated', updatedUnreadMap);
    // 新增：插入好友列表变化事件
    await pushFriendListChanged(to);
    res.json({ success: true });
  });

  // 获取与某好友的消息（含好友请求）
  // 只返回 owner=user1 的消息
  app.get('/api/messages', async (req, res) => {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) return res.json([]);
    const msgs = await db.collection('messages').find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 }
      ],
      owner: user1
    }).sort({ createdAt: 1 }).toArray();
    // 标记为已读
    await db.collection('messages').updateMany(
      { to: user1, from: user2, read: false, owner: user1 },
      { $set: { read: true } }
    );
    res.json(msgs);
  });

  // 获取所有未读消息数（拉取接口）
  app.get('/api/unread-messages', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json({});
    const msgs = await db.collection('messages').aggregate([
      { $match: { to: username, read: false } },
      { $group: { _id: '$from', count: { $sum: 1 } } }
    ]).toArray();
    const result = {};
    msgs.forEach(m => { result[m._id] = m.count; });
    res.json(result);
  });

  // 发送好友请求（消息模式）
  app.post('/api/friend-request', async (req, res) => {
    const { from, to } = req.body;
    if (!from || !to || from === to)
      return res.json({ success: false, message: '参数错误' });
    await db.collection('messages').insertOne({
      from,
      to,
      content: '',
      type: 'friend-request',
      read: false,
      createdAt: new Date()
    });
    // 删除被拒绝的记录
    await db.collection('messages').deleteMany({
      from, to, type: 'friend-request-rejected'
    });
    res.json({ success: true });
    io.to(to).emit('pending-requests-updated');
    // 新增：插入好友列表变化事件
    await pushFriendListChanged(to);
  });

  // 获取自己发出的未处理好友请求
  app.get('/api/pending-friend-requests', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    const msgs = await db.collection('messages').find({
      from: username,
      type: 'friend-request'
    }).toArray();
    res.json(msgs.map(m => m.to));
  });

  // 获取收到的未处理好友请求
  app.get('/api/received-friend-requests', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    const msgs = await db.collection('messages').find({
      to: username,
      type: 'friend-request'
    }).toArray();
    const userCol = db.collection('users');
    const fromNames = msgs.map(m => m.from);
    const users = await userCol.find({ username: { $in: fromNames } }).toArray();
    const userMap = {};
    users.forEach(u => { userMap[u.username] = u.avatar || ''; });
    res.json(msgs.map(m => ({
      from: m.from,
      avatar: userMap[m.from] || ''
    })));
  });

  // 获取被拒绝的好友请求
  app.get('/api/rejected-friend-requests', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    const msgs = await db.collection('messages').find({
      from: username,
      type: 'friend-request-rejected'
    }).toArray();
    res.json(msgs.map(m => m.to));
  });

  // 处理好友请求（同意/拒绝）
  app.post('/api/handle-friend-request', async (req, res) => {
    const { username, from, accept } = req.body;
    if (!username || !from)
      return res.json({ success: false, message: '参数错误' });
    const userCol = db.collection('users');
    if (accept) {
      // 双向添加好友
      await userCol.updateOne({ username }, { $addToSet: { friends: from } });
      await userCol.updateOne({ username: from }, { $addToSet: { friends: username } });
      // 通知双方好友列表更新
      io.to(username).emit('friend-list-updated');
      io.to(from).emit('friend-list-updated');
      // 新增：插入好友列表变化事件
      await pushFriendListChanged(username);
      await pushFriendListChanged(from);
    }
    // 删除所有该好友请求记录
    await db.collection('messages').deleteMany({
      from, to: username, type: 'friend-request'
    });
    res.json({ success: true });
    io.to(username).emit('pending-requests-updated');
    io.to(from).emit('pending-requests-updated');
  });

  // 新增：清空聊天记录，仅删除 user1 看到的与 user2 的消息
  app.post('/api/clear-chat-history', async (req, res) => {
    const { user1, user2 } = req.body;
    if (!user1 || !user2) return res.json({ success: false, message: '参数缺失' });
    // 只删除 user1 作为 owner 的消息（即 user1 看到的消息）
    await db.collection('messages').deleteMany({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 }
      ],
      owner: user1
    });
    res.json({ success: true });
  });

  // 新增：删除好友，双方解除好友关系，并通知对方
  app.post('/api/delete-friend', async (req, res) => {
    const { user1, user2 } = req.body;
    if (!user1 || !user2) return res.json({ success: false, message: '参数缺失' });
    const userCol = db.collection('users');
    // 双方都移除对方
    await userCol.updateOne({ username: user1 }, { $pull: { friends: user2 } });
    await userCol.updateOne({ username: user2 }, { $pull: { friends: user1 } });
    // 通知对方
    io.to(user2).emit('friend-removed-notice', { from: user1 });
    // 通知双方好友列表更新
    io.to(user1).emit('friend-list-updated');
    io.to(user2).emit('friend-list-updated');
    // 新增：插入好友列表变化事件
    await pushFriendListChanged(user1);
    await pushFriendListChanged(user2);
    res.json({ success: true });
  });

  // 新增：插入好友列表变化事件
  async function pushFriendListChanged(username) {
    if (!username) return;
    await db.collection('user_events').insertOne({
      username,
      type: 'friend-list-changed',
      read: false,
      createdAt: new Date()
    });
    io.to(username).emit('friend-list-changed');
  }

  // 获取未读好友列表变化事件数
  app.get('/api/friend-list-events', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json({ unread: 0 });
    const count = await db.collection('user_events').countDocuments({
      username,
      type: 'friend-list-changed',
      read: false
    });
    res.json({ unread: count });
  });

  // 标记所有好友列表变化事件为已读，并删除已读事件
  app.post('/api/friend-list-events/read', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.json({ success: false });
    // 1. 标记为已读
    await db.collection('user_events').updateMany(
      { username, type: 'friend-list-changed', read: false },
      { $set: { read: true } }
    );
    // 2. 删除所有已读事件
    await db.collection('user_events').deleteMany(
      { username, type: 'friend-list-changed', read: true }
    );
    res.json({ success: true });
  });

  // 新增：保存用户游戏标签
app.post('/api/user-game-tags', async (req, res) => {
  const { username, gameTags } = req.body;
  if (!username || !Array.isArray(gameTags)) return res.json({ success: false, message: '参数错误' });
  await db.collection('users').updateOne(
    { username },
    { $set: { gameTags: gameTags.slice(0, 5) } }
  );
  res.json({ success: true });
});

  // 启动 HTTPS 服务，监听 443 端口
  const port = 443;
  server.listen(port, () => {
    console.log(`HTTPS Server running on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB Atlas:', err);
});

console.log('TENCENT_COS_SECRET_ID:', process.env.TENCENT_COS_SECRET_ID);
console.log('TENCENT_COS_SECRET_KEY:', process.env.TENCENT_COS_SECRET_KEY);

cos.getService((err, data) => {
  if (err) {
    console.error('腾讯云 COS SDK 测试失败:', err);
  } else {
    console.log('腾讯云 COS SDK 测试成功:', data);
  }
});