const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
const https = require('https');    // 使用 https 模块
const fs = require('fs');          // 用于读取证书和私钥文件
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

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
  
  socket.on('disconnect', () => {
    console.log("Client disconnected:", socket.id);
  });
});

client.connect().then(() => {
  db = client.db('webgis0');
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

  // 用户注册
  app.post('/api/user-register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password)
      return res.json({ success: false, message: '账号和密码不能为空' });

    // 检查用户名格式（1-10个汉字）
    const chineseReg = /^[\u4e00-\u9fa5]{1,10}$/;
    if (!chineseReg.test(username)) {
      return res.json({ success: false, message: '用户名需为1-10个汉字' });
    }

    const userCol = db.collection('users');
    const exist = await userCol.findOne({ username });
    if (exist) return res.json({ success: false, message: '账号已存在' });
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
    if (!username || !avatar) return res.json({ success: false, message: '参数缺失' });
    const userCol = db.collection('users');
    await userCol.updateOne({ username }, { $set: { avatar } });
    res.json({ success: true });
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

  // 批量获取用户信息（含头像）
  app.post('/api/user-info-batch', async (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) return res.json([]);
    const userCol = db.collection('users');
    const users = await userCol.find({ username: { $in: usernames } }).toArray();
    res.json(users.map(u => ({
      username: u.username,
      avatar: u.avatar || ''
    })));
  });

  // 发送消息接口（普通消息或好友请求）
  app.post('/api/messages', async (req, res) => {
    const { from, to, content, type } = req.body;
    if (!from || !to || !content)
      return res.json({ success: false, message: '参数缺失' });
    const msg = {
      from,
      to,
      content,
      type: type || 'chat',
      read: false,
      createdAt: new Date()
    };
    await db.collection('messages').insertOne(msg);
    io.to(to).emit('chat-message', msg);
    // 计算最新的未读消息状态并推送给目标用户
    const updatedUnreadMap = await computeUnreadMapForUser(to);
    io.to(to).emit('unread-updated', updatedUnreadMap);
    res.json({ success: true });
  });

  // 获取与某好友的消息（含好友请求）
  app.get('/api/messages', async (req, res) => {
    const { user1, user2 } = req.query;
    if (!user1 || !user2) return res.json([]);
    const msgs = await db.collection('messages').find({
      $or: [
        { from: user1, to: user2 },
        { from: user2, to: user1 }
      ]
    }).sort({ createdAt: 1 }).toArray();
    // 标记为已读
    await db.collection('messages').updateMany(
      { to: user1, from: user2, read: false },
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
    }
    // 删除所有该好友请求记录
    await db.collection('messages').deleteMany({
      from, to: username, type: 'friend-request'
    });
    res.json({ success: true });
    io.to(username).emit('pending-requests-updated');
    io.to(from).emit('pending-requests-updated');
  });

  // 启动 HTTPS 服务，监听 443 端口
  const port = 443;
  server.listen(port, () => {
    console.log(`HTTPS Server running on port ${port}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB Atlas:', err);
});
