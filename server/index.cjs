const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true })); // 新增这一行

const uri = "mongodb+srv://cstgkangrui:Cu4RV8xkbdjpl6gK@webgis0.tszfumn.mongodb.net/?retryWrites=true&w=majority&appName=webgis0";
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let db;

// 只在连接成功后注册路由
client.connect().then(() => {
  db = client.db('webgis0');
  console.log('Connected to MongoDB Atlas');

  // 用户注册
  app.post('/api/user-register', async (req, res) => {
    const { username, password } = req.body;
    // 检查用户名和密码非空
    if (!username || !password) return res.json({ success: false, message: '账号和密码不能为空' });

    // 检查用户名是否为中文，且不超过10个汉字
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

  // 用户登录
  app.post('/api/user-login', async (req, res) => {
    const { username, password } = req.body;
    const userCol = db.collection('users');
    const user = await userCol.findOne({ username, password });
    if (!user) return res.json({ success: false, message: '账号或密码错误' });
    res.json({ success: true, user: { username: user.username } });
    // 登录成功后自动刷新页面由前端控制
  });

  // 用户头像上传/更换
  app.post('/api/user-avatar', async (req, res) => {
    const { username, avatar } = req.body;
    if (!username || !avatar) return res.json({ success: false, message: '参数缺失' });
    const userCol = db.collection('users');
    await userCol.updateOne({ username }, { $set: { avatar } });
    res.json({ success: true });
  });

  // 保存或更新用户坐标（每个用户只能有一条，上传新位置会覆盖旧位置）
  app.post('/api/user-location', async (req, res) => {
    const { username, avatar, lng, lat } = req.body;
    if (!username || !lng || !lat) return res.json({ success: false, message: '参数缺失' });
    await db.collection('userLocations').updateOne(
      { username },
      { $set: { username, avatar, lng, lat, updatedAt: new Date() } },
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
    const centerLng = Number(lng);
    const centerLat = Number(lat);
    const r = Number(radius) || 3000;

    // 查询所有有位置的用户
    const locations = await db.collection('userLocations').find({ lng: { $exists: true }, lat: { $exists: true } }).toArray();
    const result = [];
    for (const loc of locations) {
      // 计算距离
      const toRad = d => d * Math.PI / 180;
      const earthR = 6371000;
      const dLat = toRad(loc.lat - centerLat);
      const dLng = toRad(loc.lng - centerLng);
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(centerLat)) * Math.cos(toRad(loc.lat)) *
        Math.sin(dLng / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const dist = earthR * c;
      if (dist <= r) {
        result.push({
          username: loc.username,
          lng: loc.lng,
          lat: loc.lat,
          avatar: loc.avatar
        });
      }
    }
    res.json(result);
  });

  // 获取用户好友列表
  app.get('/api/user-friends', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    const userCol = db.collection('users');
    const userDoc = await userCol.findOne({ username });
    res.json(userDoc && userDoc.friends ? userDoc.friends : []);
  });

  // 新增：批量获取用户信息（含头像）
  app.post('/api/user-info-batch', async (req, res) => {
    const { usernames } = req.body;
    if (!Array.isArray(usernames) || usernames.length === 0) return res.json([]);
    const userCol = db.collection('users');
    const users = await userCol.find({ username: { $in: usernames } }).toArray();
    // 只返回必要字段
    res.json(users.map(u => ({
      username: u.username,
      avatar: u.avatar || ''
    })));
  });

  // 聊天消息表结构: {from, to, content, type, read, createdAt}
  // 发送消息（普通消息或好友请求）
  app.post('/api/messages', async (req, res) => {
    const { from, to, content, type } = req.body;
    if (!from || !to || !content) return res.json({ success: false, message: '参数缺失' });
    const msg = {
      from,
      to,
      content,
      type: type || 'text',
      read: false,
      createdAt: new Date()
    };
    await db.collection('messages').insertOne(msg);
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

  // 获取所有未读消息数
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
    if (!from || !to || from === to) return res.json({ success: false, message: '参数错误' });
    // 插入一条 type=friend-request 的消息
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
  });

  // 新增：获取自己发出的未处理好友请求
  app.get('/api/pending-friend-requests', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    // 查找自己发出的所有未被处理的好友请求
    const msgs = await db.collection('messages').find({
      from: username,
      type: 'friend-request'
    }).toArray();
    res.json(msgs.map(m => m.to));
  });

  // 新增：获取收到的未处理好友请求
  app.get('/api/received-friend-requests', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    // 查找所有发给自己的未被处理的好友请求
    const msgs = await db.collection('messages').find({
      to: username,
      type: 'friend-request'
    }).toArray();
    // 返回from、头像
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

  // 新增：获取被拒绝的好友请求
  app.get('/api/rejected-friend-requests', async (req, res) => {
    const { username } = req.query;
    if (!username) return res.json([]);
    // 查找被拒绝的好友请求（type: friend-request-rejected, from: username）
    const msgs = await db.collection('messages').find({
      from: username,
      type: 'friend-request-rejected'
    }).toArray();
    res.json(msgs.map(m => m.to));
  });

  // 处理好友请求（同意/拒绝）
  app.post('/api/handle-friend-request', async (req, res) => {
    const { username, from, accept } = req.body;
    if (!username || !from) return res.json({ success: false, message: '参数错误' });
    const userCol = db.collection('users');
    if (accept) {
      // 双向添加好友
      await userCol.updateOne({ username }, { $addToSet: { friends: from } });
      await userCol.updateOne({ username: from }, { $addToSet: { friends: username } });
      // 删除所有未处理的好友请求消息
      await db.collection('messages').deleteMany({
        from, to: username, type: 'friend-request'
      });
    } else {
      // 删除所有未处理的好友请求消息
      await db.collection('messages').deleteMany({
        from, to: username, type: 'friend-request'
      });
      // 删除被拒绝消息的插入（即不再插入 friend-request-rejected 消息）
    }
    // 新增：无论同意还是拒绝，都删除自己收到的该好友请求
    await db.collection('messages').deleteMany({
      from, to: username, type: 'friend-request'
    });
    res.json({ success: true });
  });

  const port = 3001;
  app.listen(port, () => {
    console.log(`Server running at http://117.72.108.239:${port}`);
  });
}).catch(err => {
  console.error('Failed to connect to MongoDB Atlas:', err);
});
