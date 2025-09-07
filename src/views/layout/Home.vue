<script setup>
// 删除 Header 导入
// import Header from './Header.vue';
import Switch from './switch.vue';
import Map from '../Map.vue';
import PublicMap from '../dataService/PublicMap.vue';
import FriendMenu from './friendmenu.vue';
import MessageDialog from './MessageDialog.vue';
import Drawdistance from '../graDraw/Drawdistance.vue';
import MapControl from './MapControl.vue'; // 引入新的地图控制组件
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { useRoute } from 'vue-router';
import { useSocket } from '@/utils/usesocket'; // 新增
import { ElMessage } from 'element-plus'
import { allGames, getGameNameById, gameCategories, gameNameToId } from '../userinformation/games.js'
import mitt from 'mitt'; // 引入 mitt 用于创建事件总线

// 创建地图控制事件总线
const mapControlEmitter = mitt();
window.__mapControlEmitter__ = mapControlEmitter;

// 控件显示状态
const controlsVisible = ref(false);

// 监听控件显示状态变化
mapControlEmitter.on('setControlsVisible', (visible) => {
  controlsVisible.value = visible;
  // 通知 MapControl 组件状态已更改
  mapControlEmitter.emit('controlsVisibleChanged', visible);
});

// 全局事件总线用于跨组件通信
const globalDialogVisible = ref(false);
window.setGlobalDialogVisible = (v) => { globalDialogVisible.value = v; };

const route = useRoute();
const defaultAvatar = '/blank-avatar.png';
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const showUserInfo = ref(false);
const avatarUrl = ref(user.value.avatar || defaultAvatar);
const uploading = ref(false);
const avatarInput = ref(null);
const selectedUser = ref(null);

const friendMenuRef = ref(null);
const globalChatDialog = ref(false);
const globalChatFriend = ref(null);
const messageDialogRef = ref(null);

let globalMsgTimer = null;
const pendingFriendRequests = ref([]);
const rejectedFriendRequests = ref([]);

// 梯形控件红点
const friendTipHasUnread = ref(false);

// 新增：补全未定义函数
async function refreshPendingRequests() {
  if (!user.value.username) return;
  const [pendingRes, rejectedRes] = await Promise.all([
    axios.get('/api/pending-friend-requests', {
      params: { username: user.value.username }
    }),
    axios.get('/api/rejected-friend-requests', {
      params: { username: user.value.username }
    })
  ]);
  pendingFriendRequests.value = pendingRes.data || [];
  rejectedFriendRequests.value = rejectedRes.data || [];
}

async function fetchFriendListEventsUnread() {
  if (!user.value.username) return;
  const res = await axios.get('/api/friend-list-events', {
    params: { username: user.value.username }
  });
  friendTipHasUnread.value = (res.data && res.data.unread > 0);
}

async function clearFriendListEvents() {
  if (!user.value.username) return;
  // 标记后端事件为已读
  await axios.post('/api/friend-list-events/read', { username: user.value.username });
  // 主动通过 socket 通知所有客户端清除红点
  if (homeSocket && homeSocket.value) {
    homeSocket.value.emit('friend-list-events-read', { username: user.value.username });
  }
  friendTipHasUnread.value = false;
}

// 新增：主界面独立初始化 socket 并监听事件
let homeSocket = null;
onMounted(async () => {
  await refreshPendingRequests();
  window.friendMenuRef = friendMenuRef;
  // 监听地图初始化完成
  if (window.map) {
    mapReady.value = true;
  } else {
    window.addEventListener('map-created', () => {
      mapReady.value = true;
    }, { once: true });
  }
  // 独立初始化 socket
  const socketData = useSocket();
  homeSocket = socketData.socket;
  window.homeSocket = homeSocket; // 全局共享
  if (user.value.username) {
    socketData.joinRoom(user.value.username);
  }
  // 监听未读消息
  homeSocket.value.on('unread-updated', async (data) => {
    await refreshPendingRequests();
    friendTipHasUnread.value = Object.values(data).some(v => v > 0);
  });
  // 监听好友请求
  homeSocket.value.on('pending-requests-updated', async () => {
    await refreshPendingRequests();
    const res = await axios.get('/api/received-friend-requests', {
      params: { username: user.value.username }
    });
    friendTipHasUnread.value = Array.isArray(res.data) && res.data.length > 0;
  });
  // 监听好友列表变化事件
  homeSocket.value.on('friend-list-changed', async () => {
    await fetchFriendListEventsUnread();
  });
  // 监听主动清除红点事件
  homeSocket.value.on('friend-list-events-read', () => {
    friendTipHasUnread.value = false;
  });
  // 监听聊天消息
  homeSocket.value.on('chat-message', (msg) => {});
});
onBeforeUnmount(() => {
  // 解绑事件
  if (homeSocket && homeSocket.value) {
    homeSocket.value.off('unread-updated');
    homeSocket.value.off('pending-requests-updated');
    homeSocket.value.off('friend-list-changed');
    homeSocket.value.off('friend-list-events-read');
    homeSocket.value.off('chat-message');
  }
  if (globalMsgTimer) clearInterval(globalMsgTimer);
  if (window.friendMenuRef === friendMenuRef) window.friendMenuRef = undefined;
});

// 聊天对话框相关
function openGlobalChatDialog(friend) {
  globalChatFriend.value = friend;
  globalChatDialog.value = true;
  nextTick(() => {
    messageDialogRef.value?.refresh && messageDialogRef.value.refresh();
    refreshPendingRequests();
  });
}
window.openGlobalChatDialog = openGlobalChatDialog;

function handleChatDialogClose() {
  globalChatDialog.value = false;
}

// 头像相关
const backendOrigin = 'https://kexiaohua.online'; // 后端部署域名

const fetchUserDetail = async () => {
  if (!user.value.username) return;
  const res = await axios.post('/api/user-info-batch', {
    usernames: [user.value.username]
  });
  if (Array.isArray(res.data) && res.data.length > 0) {
    let avatar = res.data[0].avatar || '';
    // 强制拼接后端域名
    if (avatar && avatar.startsWith('/avatars/')) {
      avatar = backendOrigin + avatar;
    }
    user.value.avatar = avatar || defaultAvatar;
    avatarUrl.value = user.value.avatar || defaultAvatar;
    localStorage.setItem('user', JSON.stringify(user.value));
  }
};
watch(() => user.value.avatar, val => {
  avatarUrl.value = val || defaultAvatar;
});
watch(() => user.value.username, val => {
  if (val) fetchUserDetail();
}, { immediate: true });

const triggerAvatarInput = () => {
  nextTick(() => {
    if (avatarInput.value) avatarInput.value.value = '';
    avatarInput.value && avatarInput.value.click();
  });
};
const handleAvatarChange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    alert('请选择图片格式的文件');
    return;
  }
  if (file.size > 2 * 1024 * 1024) {
    e.target.value = '';
    alert('请选择2MB以内的图片');
    return;
  }
  const reader = new FileReader();
  reader.onload = async (evt) => {
    const base64 = evt.target.result;
    avatarUrl.value = base64;
    uploading.value = true;
    try {
      // 1. 上传头像到后端
      const res = await axios.post('/api/user-avatar', {
        username: user.value.username,
        avatar: base64
      });
      if (res.data.success) {
        // 2. 上传成功后，重新拉取后端头像URL，确保 user.avatar 为 URL
        const infoRes = await axios.post('/api/user-info-batch', {
          usernames: [user.value.username]
        });
        if (Array.isArray(infoRes.data) && infoRes.data.length > 0) {
          let avatar = infoRes.data[0].avatar || '';
          if (avatar && avatar.startsWith('/avatars/')) {
            avatar = backendOrigin + avatar;
          }
          user.value.avatar = avatar || defaultAvatar;
          avatarUrl.value = user.value.avatar;
          localStorage.setItem('user', JSON.stringify(user.value));
        }
      }
    } finally {
      uploading.value = false;
    }
  };
  reader.readAsDataURL(file);
};

const logout = () => {
  localStorage.removeItem('user');
  window.location.reload();
};

const handleDialogClose = () => {
  showUserInfo.value = false;
  if (window.setGlobalDialogVisible) window.setGlobalDialogVisible(false);
};

// 修正：安全调用 window.setGlobalDialogVisible
function onUserInfoDialogOpen() {
  console.log('[调试] onUserInfoDialogOpen 执行，弹窗即将打开');
  if (typeof window !== 'undefined' && typeof window.setGlobalDialogVisible === 'function') {
    window.setGlobalDialogVisible(true);
  }
  // 不再检查 el-overlay，只在 after-enter 检查 el-dialog__wrapper
}

// 只保留一个 onUserInfoDialogAfterEnter 方法
function onUserInfoDialogAfterEnter() {
  console.log('[调试] onUserInfoDialogAfterEnter 执行');
  const wrappers = document.querySelectorAll('.el-dialog__wrapper');
  console.log('[调试] after-enter时 el-dialog__wrapper 数量:', wrappers.length);
  wrappers.forEach((wrapper, idx) => {
    const hasClass = wrapper.classList.contains('user-info-cuphead-bg');
    console.log(`[调试] after-enter el-dialog__wrapper[${idx}]`, wrapper, '是否有 user-info-cuphead-bg:', hasClass, 'classList:', wrapper.classList.value);
    if (hasClass) {
      console.log('[调试] 当前 wrapper 的 computed style:', getComputedStyle(wrapper));
    }
  });
}


// 好友请求按钮状态
const isPending = computed(() =>
  selectedUser.value && pendingFriendRequests.value.includes(selectedUser.value.username)
);
const isRejected = computed(() =>
  selectedUser.value && rejectedFriendRequests.value.includes(selectedUser.value.username)
);

const isLoginPage = computed(() => route.name === 'UserLogin');
// 修改这里，注册页也隐藏右下角控件
const isRegisterPage = computed(() => route.name === 'UserRegister');
const hideSwitchPanel = computed(() => isLoginPage.value || isRegisterPage.value || showUserInfo.value || globalDialogVisible.value || !controlsVisible.value);

// 打开好友列表方法，兼容PC和移动端
const showFriendList = () => {
  if (friendMenuRef.value) {
    friendMenuRef.value.showFriendList = true;
    // 新增：打开好友列表时清除红点
    clearFriendListEvents();
  }
};

// 兼容PC和移动端，确保弹出好友列表
const handleFriendTip = (e) => {
  e && e.preventDefault && e.preventDefault();
  if (friendMenuRef.value) {
    if (typeof friendMenuRef.value.showFriendList === 'function') {
      friendMenuRef.value.showFriendList();
    } else {
      friendMenuRef.value.showFriendList = true;
    }
    // 新增：打开好友列表时清除红点
    clearFriendListEvents();
  }
};

// 修正：安全判断 window 和 showUserInfo
function onUserAvatarClick() {
  // 避免 window 为 undefined 或 __drawdistance_disable_userinfo__ 为 true
  if (typeof window !== 'undefined' && window.__drawdistance_disable_userinfo__) {
    return;
  }
  // showUserInfo 可能为 ref，也可能为 false，需判断
  if (showUserInfo && typeof showUserInfo === 'object' && 'value' in showUserInfo) {
    showUserInfo.value = true;
    console.log('[调试] showUserInfo.value 已设置为 true');
  }
}

// 新增：好友菜单是否展开
const friendMenuVisible = computed(() => {
  return !!(friendMenuRef.value && friendMenuRef.value.showFriendList);
});

// 页面初始化时拉取一次未读消息和好友请求，保证红点初始状态正确
onMounted(async () => {
  await fetchFriendListEventsUnread();
  nextTick(() => {
    if (friendMenuRef.value && friendMenuRef.value.socket && !friendMenuRef.value._setupFriendListEventSocket) {
      setupFriendListEventSocket(friendMenuRef.value.socket);
      friendMenuRef.value._setupFriendListEventSocket = true;
    }
  });
  // 默认隐藏控件
  controlsVisible.value = false;
});

// 头像加载失败回调，防止未定义警告
function onAvatarError(e) {
  avatarUrl.value = defaultAvatar;
}

const mapReady = ref(false); // 修复 mapReady 未定义

// 游戏标签相关（编号存储）
const myGameTags = ref([]) // 当前用户已选标签（编号数组）
const showGameTagDialog = ref(false)
const gameTagSelect = ref([]) // 选择过程中的标签编号数组

// 标签颜色映射
const tagColors = ['#222', '#67c23a', '#409eff', '#a259e6', '#f56c6c']
const tagColorNames = ['黑色', '绿色', '蓝色', '紫色', '红色']

// 统计标签出现次数
const getTagStats = (tags) => {
  const stats = {}
  tags.forEach(id => {
    stats[id] = (stats[id] || 0) + 1
  })
  return stats
}

// 合并标签逻辑：同一个标签出现多次，显示为一个标签，颜色随次数变化
const getMergedTags = (tags) => {
  const stats = getTagStats(tags)
  return Object.entries(stats).map(([id, count]) => ({
    id: Number(id),
    count,
    color: tagColors[Math.min(count - 1, tagColors.length - 1)],
    colorName: tagColorNames[Math.min(count - 1, tagColors.length - 1)]
  }))
}

// 拉取用户标签（编号数组）
const fetchUserTags = async () => {
  if (!user.value.username) return
  const res = await axios.post('/api/user-info-batch', { usernames: [user.value.username] })
  if (Array.isArray(res.data) && res.data.length > 0) {
    myGameTags.value = res.data[0].gameTags || []
  }
}
watch(() => showUserInfo.value, v => { 
  console.log('[调试] showUserInfo.value 变化:', v);
  if (v) fetchUserTags() 
})

// 保存标签到后端（编号数组，允许重复，最多5个）
const saveGameTags = async () => {
  if (!user.value.username) return
  // 直接保存选择的标签编号数组（允许重复），最多5个
  const tagsToSave = gameTagSelect.value.slice(0, 5)
  await axios.post('/api/user-game-tags', {
    username: user.value.username,
    gameTags: tagsToSave
  })
  myGameTags.value = tagsToSave
  showGameTagDialog.value = false
  ElMessage.success('游戏标签已保存')
  // 新增：保存后自动打开个人信息弹窗
  nextTick(() => {
    showUserInfo.value = true
  })
}

// 打开标签选择框（自动关闭个人信息弹窗）
const openGameTagDialog = () => {
  gameTagSelect.value = [...myGameTags.value]
  showUserInfo.value = false
  nextTick(() => {
    showGameTagDialog.value = true
  })
}

// 新增：关闭标签选择弹窗时自动打开个人信息弹窗
watch(showGameTagDialog, (v, oldV) => {
  if (oldV && !v) {
    nextTick(() => {
      showUserInfo.value = true
    })
  }
})

// 选择标签（允许重复选择）
function handleTagSelect(id) {
  if (gameTagSelect.value.length < 5) {
    gameTagSelect.value.push(id)
  }
}

// 删除标签（下方标签位点击可移除一个）
function removeTag(id) {
  // 只移除最后一个该id
  const idx = gameTagSelect.value.lastIndexOf(id)
  if (idx !== -1) {
    gameTagSelect.value.splice(idx, 1)
  }
}

// 修改：监听drawActive状态变化，保证测距功能优先级
if (window.__distanceEmitter__) {
  window.__distanceEmitter__.on('distanceControlSwitch', (active) => {
    if (active) {
      // 测距工具激活时，确保控件可见
      controlsVisible.value = true;
      mapControlEmitter.emit('controlsVisibleChanged', true);
    }
  });
}

// 页面边框特效控制 - 修改为默认启用且不可见控件
const borderEffectEnabled = ref(true); // 默认启用

// 页面加载完成后初始化Canvas粒子效果
onMounted(() => {
  // 粒子边框特效初始化
  nextTick(() => {
    initParticleBorder();
  });
});

// 初始化粒子边框特效
function initParticleBorder() {
  // 创建Canvas元素
  const canvas = document.createElement('canvas');
  canvas.id = 'particleBorderCanvas';
  canvas.className = 'particle-border-canvas';
  document.body.appendChild(canvas);
  
  // 设置Canvas尺寸
  const resizeCanvas = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
  
  // 获取Canvas上下文
  const ctx = canvas.getContext('2d');
  
  // 粒子类 - 修改为从边缘向内部扩散
  class Particle {
    constructor() {
      this.reset();
      // 初始时让粒子处于随机生命周期，避免同时出现
      this.life = Math.floor(Math.random() * this.maxLife * 0.8);
      this.active = true; // 标记粒子是否活跃
    }
    
    reset() {
      // 减小边框范围：从原来的整个屏幕四周改为只在边框区域内活动
      const borderWidth = 40; // 边框宽度
      
      // 随机决定粒子出现在哪条边
      const edge = Math.floor(Math.random() * 4);
      
      switch(edge) {
        case 0: // 上边
          this.x = Math.random() * canvas.width;
          this.y = Math.random() * borderWidth;
          this.vx = (Math.random() - 0.5) * 0.5; // 水平随机，原来是0.8
          this.vy = Math.random() * 0.4 + 0.2; // 向下移动(向内)，原来是0.6+0.4
          break;
        case 1: // 右边
          this.x = canvas.width - Math.random() * borderWidth;
          this.y = Math.random() * canvas.height;
          this.vx = -Math.random() * 0.4 - 0.2; // 向左移动(向内)，原来是0.6+0.4
          this.vy = (Math.random() - 0.5) * 0.5; // 垂直随机，原来是0.8
          break;
        case 2: // 下边
          this.x = Math.random() * canvas.width;
          this.y = canvas.height - Math.random() * borderWidth;
          this.vx = (Math.random() - 0.5) * 0.5; // 水平随机，原来是0.8
          this.vy = -Math.random() * 0.4 - 0.2; // 向上移动(向内)，原来是0.6+0.4
          break;
        case 3: // 左边
          this.x = Math.random() * borderWidth;
          this.y = Math.random() * canvas.height;
          this.vx = Math.random() * 0.4 + 0.2; // 向右移动(向内)，原来是0.6+0.4
          this.vy = (Math.random() - 0.5) * 0.5; // 垂直随机，原来是0.8
          break;
      }
      
      // 记录粒子起源边，用于判断是否向内扩散
      this.originEdge = edge;
      
      // 设置速度上限，进一步降低最大速度
      this.maxSpeed = 0.6;
      
      this.alpha = 0;
      this.maxAlpha = Math.random() * 0.4 + 0.2;
      this.size = Math.random() * 3 + 1;
      this.growth = Math.random() * 0.03 + 0.005;
      this.life = 0;
      this.maxLife = Math.random() * 150 + 120;
      this.fadeSpeed = 0.008;
      this.active = true; // 重置时激活粒子
      
      // 随机获取奶油黄或棕色系的颜色
      const colors = [
        'rgba(245, 225, 164, 0.8)',  // 奶油黄
        'rgba(166, 124, 82, 0.6)',   // 棕色
        'rgba(245, 181, 7, 0.7)',    // 金黄色
        'rgba(124, 74, 30, 0.5)'     // 深棕色
      ];
      this.color = colors[Math.floor(Math.random() * colors.length)];
    }
    
    update() {
      // 粒子未激活时不更新
      if (!this.active) return;
      
      // 移动粒子
      this.x += this.vx;
      this.y += this.vy;
      
      // 限制粒子速度，防止速度持续增加
      this.vx = Math.max(Math.min(this.vx, this.maxSpeed), -this.maxSpeed);
      this.vy = Math.max(Math.min(this.vy, this.maxSpeed), -this.maxSpeed);
      
      // 粒子初始淡入 - 更平滑的淡入效果
      if (this.alpha < this.maxAlpha && this.life < this.maxLife * 0.2) {
        this.alpha += 0.005; // 降低淡入速度
      }
      
      // 粒子逐渐淡出 - 更平滑的淡出效果
      if (this.life > this.maxLife * 0.6) {
        this.alpha -= this.fadeSpeed;
        // 逐渐减慢淡出速度，使消失更加柔和
        if (this.alpha < 0.1) {
          this.fadeSpeed = 0.003;
        }
      }
      
      // 粒子逐渐变大，但速度更慢
      this.size += this.growth * 0.6;
      
      this.life++;
      
      // 检查粒子是否需要重置
      if (this.alpha <= 0.01 || 
          this.life >= this.maxLife || 
          this.size > 10 ||
          this.isDeepInside() ||
          this.isOutOfScreen()) {
        this.active = false; // 标记为不活跃，等待再次激活
        return;
      }
    }
    
    // 检查粒子是否已经深入屏幕内部
    isDeepInside() {
      const borderWidth = 120; // 从边缘向内的检测距离，降低了一些，原来是150
      
      // 根据粒子的起源边，检查是否已经向内移动了足够距离
      switch(this.originEdge) {
        case 0: // 上边
          return this.y > borderWidth && this.life > 30; // 增加生命周期检查，原来是20
        case 1: // 右边
          return this.x < canvas.width - borderWidth && this.life > 30;
        case 2: // 下边
          return this.y < canvas.height - borderWidth && this.life > 30;
        case 3: // 左边
          return this.x > borderWidth && this.life > 30;
        default:
          return false;
      }
    }
    
    // 检查粒子是否完全离开屏幕
    isOutOfScreen() {
      return (this.x < -50 || 
              this.x > canvas.width + 50 || 
              this.y < -50 || 
              this.y > canvas.height + 50);
    }
    
    draw(ctx) {
      // 粒子未激活时不绘制
      if (!this.active) return;
      
      // 使用径向渐变，使粒子更加柔和自然
      const gradient = ctx.createRadialGradient(
        this.x, this.y, 0, 
        this.x, this.y, this.size
      );
      
      const color = this.color.replace(/0\.\d+\)/, this.alpha + ')');
      gradient.addColorStop(0, color);
      
      // 使用正则表达式正确替换透明度
      const middleColor = color.replace(/rgba\((\d+,\s*\d+,\s*\d+),\s*[\d.]+\)/, 'rgba($1, 0.5)');
      gradient.addColorStop(0.6, middleColor); // 中间透明度降低
      
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      
      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  
  // 创建粒子池，初始时所有粒子都是不活跃的
  const particlePool = [];
  const maxParticles = Math.min(100, Math.max(50, Math.floor((canvas.width + canvas.height) / 30)));
  
  for (let i = 0; i < maxParticles; i++) {
    const particle = new Particle();
    particle.active = false; // 初始时所有粒子都不活跃
    particlePool.push(particle);
  }
  
  // 控制粒子生成频率的参数
  const particlesPerSecond = 10; // 每秒生成粒子数
  let lastParticleTime = 0; // 上次生成粒子的时间
  let activeParticles = 0; // 当前活跃的粒子数
  
  // 动画循环
  function animate(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制带有渐变的边框效果
    const borderWidth = 40;
    
    // 上边框渐变 - 使用更柔和的透明度
    const topGradient = ctx.createLinearGradient(0, 0, 0, borderWidth);
    topGradient.addColorStop(0, 'rgba(245, 225, 164, 0.25)');
    topGradient.addColorStop(1, 'rgba(245, 225, 164, 0)');
    ctx.fillStyle = topGradient;
    ctx.fillRect(0, 0, canvas.width, borderWidth);
    
    // 右边框渐变
    const rightGradient = ctx.createLinearGradient(canvas.width, 0, canvas.width - borderWidth, 0);
    rightGradient.addColorStop(0, 'rgba(166, 124, 82, 0.25)');
    rightGradient.addColorStop(1, 'rgba(166, 124, 82, 0)');
    ctx.fillStyle = rightGradient;
    ctx.fillRect(canvas.width - borderWidth, 0, borderWidth, canvas.height);
    
    // 下边框渐变
    const bottomGradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - borderWidth);
    bottomGradient.addColorStop(0, 'rgba(245, 181, 7, 0.25)');
    bottomGradient.addColorStop(1, 'rgba(245, 181, 7, 0)');
    ctx.fillStyle = bottomGradient;
    ctx.fillRect(0, canvas.height - borderWidth, canvas.width, borderWidth);
    
    // 左边框渐变
    const leftGradient = ctx.createLinearGradient(0, 0, borderWidth, 0);
    leftGradient.addColorStop(0, 'rgba(124, 74, 30, 0.25)');
    leftGradient.addColorStop(1, 'rgba(124, 74, 30, 0)');
    ctx.fillStyle = leftGradient;
    ctx.fillRect(0, 0, borderWidth, canvas.height);
    
    // 控制粒子生成频率
    if (timestamp - lastParticleTime > 1000 / particlesPerSecond) {
      // 尝试激活一个不活跃的粒子
      const inactiveParticle = particlePool.find(p => !p.active);
      if (inactiveParticle) {
        inactiveParticle.reset();
        activeParticles++;
      }
      lastParticleTime = timestamp;
    }
    
    // 更新粒子活跃数量计数
    activeParticles = 0;
    
    // 更新并绘制粒子
    for (const particle of particlePool) {
      particle.update();
      particle.draw(ctx);
      if (particle.active) {
        activeParticles++;
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  // 启动动画
  requestAnimationFrame(animate);
  
  // 返回清理函数
  return () => {
    window.removeEventListener('resize', resizeCanvas);
    canvas.remove();
  };
}

// 修改：移除滤镜相关代码，保留设置函数
</script>

<template>
  <div class="home-root">
    <!-- 左侧SVG图标，弹出好友列表时消失，收回时出现，带动画 -->
    <transition name="friend-tip-fade-slide">
      <img
        v-if="!friendMenuVisible"
        :src="friendTipHasUnread ? '/newmessgae.svg' : '/zhaoshou.svg'"
        :alt="friendTipHasUnread ? '有新消息' : '招手'"
        class="friend-tip-svg-abs"
        @mouseenter="handleFriendTip"
        @touchstart="handleFriendTip"
        @click="handleFriendTip"
        title="点击或触摸打开好友列表"
        draggable="false"
      />
    </transition>
    <FriendMenu ref="friendMenuRef" @open-chat="openGlobalChatDialog" />
    <Map class="map-bg" />
    <!-- 删除 Header 组件 -->
    <!-- <Header class="header-fixed"/> -->
    <!-- 用户头像控件，右上角 -->
    <div
      class="user-avatar"
      @click="onUserAvatarClick"
      :style="{ pointerEvents: isLoginPage ? 'none' : 'auto', zIndex: 4000 }"
    >
      <el-avatar
        :size="64"
        :src="avatarUrl"
        @error="onAvatarError"
      />
    </div>
    <!-- 用户信息弹窗 -->
    <el-dialog
      v-model="showUserInfo"
      title=""
      width="540px"
      :close-on-click-modal="true"
      :modal="true"
      append-to-body
      class="user-info-dialog cuphead-bg"
      :wrapper-class="'user-info-cuphead-bg'"
      :z-index="4100"
      @open="onUserInfoDialogOpen"
      @after-enter="onUserInfoDialogAfterEnter"
      @close="handleDialogClose"
      :close-on-press-escape="true"
      :show-close="false"
    >
      <template #header="{ close }">
        <div class="cuphead-header-bar">
          <span class="cuphead-title-text">英雄信息</span>
          <button class="cuphead-close-btn" aria-label="关闭" @click="close">
            <img src="/cross-156772.svg" alt="关闭" class="cuphead-close-svg" width="32" height="32" />
          </button>
        </div>
      </template>
      <div class="cuphead-content-bg">
        <div class="cuphead-avatar-area">
          <div class="avatar-frame">
            <el-avatar :size="120" :src="avatarUrl" class="avatar-img" />
            <div class="avatar-glow"></div>
          </div>
          <div class="user-name">{{ user.username }}</div>
        </div>
        <div class="cuphead-divider"></div>
        <div class="cuphead-section">
          <div class="section-title">我的游戏标签</div>
          <div class="tag-list">
            <template v-for="tag in getMergedTags(myGameTags)" :key="tag.id">
              <el-tag
                :style="{
                  backgroundColor: tag.color,
                  color: '#fff',
                  fontWeight: 'bold',
                  fontSize: '18px',
                  border: 'none',
                  fontFamily: '\'JiangxiZhuokai\',cursive,sans-serif'
                }"
                class="cuphead-tag"
              >
                {{ getGameNameById(tag.id) }}
                <span v-if="tag.count > 1" style="margin-left:6px;">x{{ tag.count }}</span>
              </el-tag>
            </template>
            <template v-for="n in (5 - myGameTags.length)" :key="'empty-'+n">
              <el-tag
                type="info"
                class="cuphead-tag-empty"
              >空</el-tag>
            </template>
          </div>
          <div class="cuphead-btn-center">
            <el-button
              type="primary"
              size="large"
              class="cuphead-btn cuphead-game-btn-2d"
              @click="openGameTagDialog"
            >添加/修改标签</el-button>
          </div>
        </div>
        <div class="cuphead-divider"></div>
        <div class="cuphead-section">
          <el-button
            type="primary"
            :loading="uploading"
            class="cuphead-btn cuphead-game-btn-2d cuphead-btn-avatar"
            @click="triggerAvatarInput"
          >更换头像</el-button>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            @change="handleAvatarChange"
            style="display:none"
          />
        </div>
        <div class="cuphead-divider"></div>
        <div class="cuphead-section">
          <el-button
            type="success"
            v-if="selectedUser && user.username !== selectedUser.username"
            :disabled="isPending"
            class="cuphead-btn cuphead-game-btn-2d"
            @click="friendMenuRef.value?.sendFriendRequest(selectedUser.value.username)"
          >
            {{ isPending ? '交友请求已发送' : '发送好友请求' }}
          </el-button>
          <span v-if="isRejected" class="cuphead-reject-tip">对方已拒绝，请重新发送</span>
          <el-button type="danger" class="cuphead-btn cuphead-game-btn-2d cuphead-btn-danger" @click="logout">退出登录</el-button>
        </div>
      </div>
    </el-dialog>
    <!-- 游戏标签选择弹窗 -->
    <el-dialog
      v-model="showGameTagDialog"
      title="选择你喜欢的游戏（可以重复选择哦！）"
      width="720px"
      append-to-body
      :close-on-click-modal="true"
      :wrapper-class="'user-info-cuphead-bg'"
      :show-close="false"
    >
      <template #header="{ close }">
        <div class="cuphead-header-bar">
          <span class="cuphead-title-text">选择你喜欢的游戏（可以重复选择哦！）</span>
          <button class="cuphead-close-btn" aria-label="关闭" @click="showGameTagDialog = false">
            <img src="/cross-156772.svg" alt="关闭" class="cuphead-close-svg" width="32" height="32" />
          </button>
        </div>
      </template>
      <div class="cuphead-content-bg cuphead-font">
        <div style="display:flex;justify-content:center;align-items:center;margin-bottom:18px;gap:12px;">
          <template v-for="tag in getMergedTags(gameTagSelect)" :key="tag.id">
            <el-tag
              :style="{
                backgroundColor: tag._hover ? '#fffbe6' : tag.color,
                color: tag._hover ? '#a67c52' : '#fff',
                fontWeight: 'bold',
                fontSize: '16px',
                cursor: 'pointer',
                border: 'none',
                fontFamily: '\'JiangxiZhuokai\',cursive,sans-serif'
              }"
              class="cuphead-tag cuphead-font"
              @mouseenter="tag._hover = true"
              @mouseleave="tag._hover = false"
              @click="removeTag(tag.id)"
            >
              {{ getGameNameById(tag.id) }}
              <span v-if="tag.count > 1" style="margin-left:6px;">x{{ tag.count }}</span>
            </el-tag>
          </template>
          <template v-for="n in (5 - gameTagSelect.length)" :key="'empty-'+n">
            <span class="cuphead-tag-empty cuphead-font">空</span>
          </template>
        </div>
        <!-- 分类选择区，添加滚动容器 -->
        <div class="cuphead-game-scroll">
          <div v-for="cat in gameCategories" :key="cat.type" style="margin-bottom:12px;">
            <div class="cuphead-game-type cuphead-font">{{ cat.type }}</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              <el-button
                v-for="game in cat.games"
                :key="game"
                :type="'default'"
                class="cuphead-game-btn cuphead-font"
                @click="handleTagSelect(gameNameToId[game])"
                :disabled="gameTagSelect.length >= 5"
              >{{ game }}</el-button>
            </div>
          </div>
        </div>
        <div style="margin-top:18px;text-align:right;">
          <el-button
            type="primary"
            class="cuphead-btn-yellow cuphead-font"
            @click="saveGameTags"
          >保存</el-button>
          <el-button
            class="cuphead-btn-yellow cuphead-font"
            @click="showGameTagDialog = false"
          >取消</el-button>
        </div>
      </div>
    </el-dialog>
    <MessageDialog
      ref="messageDialogRef"
      v-if="globalChatDialog"
      :friend="globalChatFriend"
      :visible="globalChatDialog"
      @close="handleChatDialogClose"
    />
    <div class="layout-content">
      <div class="main-content">
        <main class="content">
          <router-view />
        </main>
        <PublicMap />
        <!-- 保留Drawdistance组件但移除display:none样式 -->
        <Drawdistance v-if="mapReady" @mounted="() => console.log('[Home.vue] Drawdistance mounted')" />
      </div>
    </div>
    <!-- 添加地图控制组件 -->
    <MapControl />
    <!-- 右下角控件组合：增加控件可见性控制 -->
    <div
      class="switch-bottom-panel"
      v-if="!hideSwitchPanel"
      :style="{ 
        pointerEvents: !hideSwitchPanel ? 'auto' : 'none',
        opacity: controlsVisible ? 1 : 0,
        transform: controlsVisible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.3s, transform 0.3s'
      }"
    >
      <Switch />
    </div>
    
    <!-- 边框特效Canvas样式 -->
    <div id="particleBorderCanvas" class="particle-border-canvas"></div>
  </div>
</template>

<style>
.home-root {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  margin: 0;
  padding: 0;
  z-index: 0;
}
.map-bg {
  position: fixed;
  left: 0;
  top: 0;
  width: 100vw;
  height: 100vh;
  z-index: 0;
}
/* 删除 header-fixed 相关样式 */
/*.header-fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  z-index: 10;
}*/
.layout-content {
  position: absolute;
  left: 0;
  top: 0; /* 修改：原本是 36px (Header高度)，现在改为 0 */
  width: 100vw;
  height: 100vh; /* 修改：原本是 calc(100vh - 36px)，现在是 100vh */
  z-index: 1;
  pointer-events: none;
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1;
  height: 100%;
  position: relative;
  flex-direction: column;
  display: flex;
}
.content {
  flex: 1;
  overflow: auto;
  height: 100%;
}
/* 右下角控件组合 */
.switch-bottom-panel {
  position: fixed;
  right: 40px;
  bottom: 80px;
  z-index: 3002;
  pointer-events: auto;
  background: rgba(255,255,255,0.95);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 10px 18px 10px 18px;
  transition: opacity 0.2s;
}
/* 右上角用户头像 */
.user-avatar {
  position: fixed;
  top: 48px; /* 往下调整距离 */
  right: 40px;
  z-index: 4000;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: box-shadow 0.2s;
  pointer-events: auto;
}
.avatar-upload-label {
  display: inline-block;
  cursor: pointer;
}
/* 删除梯形相关样式，新增绝对定位SVG样式 */
.friend-tip-svg-abs {
  position: fixed;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 5001;
  width: 72px;
  height: 180px;
  cursor: pointer;
  user-select: none;
  pointer-events: auto;
  transition: opacity 0.2s;
}
@media (max-width: 600px) {
  .friend-tip-svg-abs {
    width: 54px;
    height: 120px;
  }
}

/* 动画：淡入淡出+左右滑动 */
.friend-tip-fade-slide-enter-active,
.friend-tip-fade-slide-leave-active {
  transition: opacity 0.3s;
}
.friend-tip-fade-slide-enter-from,
.friend-tip-fade-slide-leave-to {
  opacity: 0;
}
.friend-tip-fade-slide-enter-to,
.friend-tip-fade-slide-leave-from {
  opacity: 1;
}

/* 保证el-dialog弹窗层级高于其他控件 */
:deep(.el-overlay) {
  z-index: 4100 !important;
}
:deep(.el-dialog) {
  z-index: 4101 !important;
}
/* 确保地图层级最低 */
:deep(.ol-layer),
:deep(.ol-viewport),
:deep(.ol-unselectable) {
  z-index: 0 !important;
}

/* 卡通复古橡胶管动画风格弹窗外层 */
.el-dialog__wrapper.user-info-cuphead-bg {
  background: linear-gradient(135deg, #e0bf18 0%, #f3b90a 100%);
  border-radius: 40px;
  min-width: 440px;
  min-height: 540px;
  max-width: 620px;
  max-height: 720px;
  aspect-ratio: 1/1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 12px 48px rgba(80,60,30,0.18),
    0 0 0 16px #c7a16b inset,
    0 0 0 3px #7c4a1e;
  position: relative;
  overflow: hidden;
}

/* 让弹窗本体和内容区都透明，背景由外部渲染 */
.el-dialog__wrapper.user-info-cuphead-bg .el-dialog,
.el-dialog__wrapper.user-info-cuphead-bg .el-dialog__header,
.el-dialog__wrapper.user-info-cuphead-bg .el-dialog__body {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 40px !important;
  border: none !important;
  padding: 0 !important;
}

/* 修改：删除内容区卡通风格的背景 */
.cuphead-content-bg {
  background: transparent !important; /* 修改为透明背景 */
  border-radius: 32px;
  box-shadow: none !important; /* 移除阴影 */
  padding: 32px 0 24px 0;
  margin: 0 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* 标题栏卡通装饰 - 保持透明背景 */
.cuphead-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px 0 0;
  background: transparent !important; /* 修改为透明背景 */
  box-shadow: none !important; /* 移除阴影 */
  border: none !important; /* 移除边框 */
}

/* 手绘风格关闭按钮 */
.cuphead-close-btn {
  background: #fffbe6;
  border: 2px solid #a67c52;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  box-shadow: 0 2px 8px #a67c52, 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, box-shadow 0.2s;
  margin-left: 12px;
  outline: none;
  padding: 0;
}
.cuphead-close-btn:hover {
  background: #f5b507;
  box-shadow: 0 4px 16px #a67c52, 0 2px 8px rgba(0,0,0,0.12);
}
.cuphead-close-svg {
  display: block;
  width: 32px;
  height: 32px;
}

/* 内容区卡通风格 */
.cuphead-content-bg {
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%);
  border-radius: 32px;
  box-shadow: 0 4px 24px rgba(166,124,82,0.08);
  padding: 32px 0 24px 0;
  margin: 0 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* 头像区域 */
.cuphead-avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
}
.avatar-frame {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-img {
  box-shadow: 0 0 24px #f5b507, 0 2px 8px rgba(0,0,0,0.10);
  border: 4px solid #f5b507;
  border-radius: 50%;
  background: #fff;
}
.avatar-glow {
  position: absolute;
  left: 0; top: 0;
  width: 140px; height: 140px;
  border-radius: 50%;
  box-shadow: 0 0 32px 12px #f5b507, 0 0 0 8px #fff inset;
  pointer-events: none;
  z-index: 1;
}
.user-name {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 28px;
  font-weight: bold;
  color: #a67c52;
  margin-top: 10px;
  text-shadow: 2px 2px 0 #f5e1a4, 0 2px 8px #a67c52;
}

/* 分割线 */
.cuphead-divider {
  width: 80%;
  height: 0;
  border-bottom: 2px dashed #e7cfa2;
  margin: 18px 0;
  opacity: 0.7;
}

/* 区块标题 */
.section-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 22px;
  font-weight: bold;
  color: #7c4a1e;
  margin-bottom: 10px;
  text-shadow: 1px 1px 0 #f5e1a4;
  letter-spacing: 2px;
}

/* 标签列表 */
.tag-list {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.cuphead-tag {
  border-radius: 16px !important;
  box-shadow: 0 2px 8px rgba(166,124,82,0.10);
  font-size: 18px !important;
  padding: 6px 18px !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  border: none !important;
  font-weight: bold !important;
  transition: background 0.2s, box-shadow 0.2s;
}
.cuphead-tag-hover,
.cuphead-tag:hover {
  box-shadow: 0 4px 16px #f5e1a4, 0 2px 8px rgba(0,0,0,0.10);
}

/* 空标签位2D卡通风格 */
.cuphead-tag-empty {
  display: inline-block;
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%) !important;
  color: #a67c52 !important;
  border-radius: 16px !important;
  font-size: 18px !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  padding: 6px 18px !important;
  border: 2px dashed #e7cfa2 !important;
  box-shadow: 0 2px 8px rgba(166,124,82,0.10);
  margin-right: 6px;
  margin-left: 0;
  font-weight: bold !important;
  text-align: center;
  vertical-align: middle;
}

/* 奶油黄按钮风格 */
.cuphead-btn-yellow {
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%) !important;
  color: #a67c52 !important;
  border-radius: 16px !important;
  border: 2px solid #e7cfa2 !important;
  font-weight: bold !important;
  box-shadow: 0 2px 8px #f5e1a4, 0 2px 8px rgba(0,0,0,0.08);
  padding: 8px 28px !important;
  margin: 8px 0;
  font-size: 18px !important;
  transition: background 0.2s, box-shadow 0.2s;
}
.cuphead-btn-yellow:hover {
  background: linear-gradient(90deg, #f5e1a4 0%, #fffbe6 100%) !important;
  color: #a67c52 !important;
  box-shadow: 0 4px 16px #e7cfa2, 0 2px 8px rgba(0,0,0,0.12);
}

/* 奶油黄游戏目录标签按钮风格 */
.cuphead-game-btn {
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%) !important;
  color: #a67c52 !important;
  border-radius: 16px !important;
  border: 2px solid #e7cfa2 !important;
  font-weight: bold !important;
  box-shadow: 0 2px 8px #f5e1a4, 0 2px 8px rgba(0,0,0,0.08);
  padding: 8px 22px !important;
  margin: 8px 0;
  font-size: 16px !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  transition: background 0.2s, box-shadow 0.2s, color 0.2s;
}
.cuphead-game-btn:hover,
.cuphead-game-btn:focus {
  background: linear-gradient(90deg, #f5e1a4 0%, #ffe066 100%) !important;
  color: #7c4a1e !important;
  box-shadow: 0 4px 16px #e7cfa2, 0 2px 8px rgba(0,0,0,0.12);
  border-color: #a67c52 !important;
}

/* 游戏目录滚动容器：加宽并拉长 */
.cuphead-game-scroll {
  max-height: 420px;
  min-height: 320px;
  width: 96%;
  overflow-y: auto;
  padding-right: 8px;
  margin-bottom: 8px;
  /* 美化滚动条 */
  scrollbar-width: thin;
  scrollbar-color: #e7cfa2 #fffbe6;
}
.cuphead-game-scroll::-webkit-scrollbar {
  width: 8px;
  background: #fffbe6;
  border-radius: 8px;
}
.cuphead-game-scroll::-webkit-scrollbar-thumb {
  background: #e7cfa2;
  border-radius: 8px;
}

/* 游戏类型字体放大 */
.cuphead-game-type {
  font-size: 22px;
  font-weight: bold;
  color: #a67c52;
  margin-bottom: 6px;
  margin-top: 8px;
  text-shadow: 1px 1px 0 #f5e1a4;
  letter-spacing: 2px;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
}

/* 字体全局应用 */
.cuphead-font, .cuphead-content-bg, .cuphead-header-bar, .cuphead-title-text, .cuphead-btn, .cuphead-tag, .cuphead-tag-empty, .el-button, .el-tag {
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
}

/* 茶杯头风格的2D手绘按钮 */
.cuphead-game-btn-2d {
  background: #fff6d0 !important;
  color: #7c4a1e !important;
  border: 3px solid #7c4a1e !important;
  border-radius: 18px !important;
  font-weight: bold !important;
  box-shadow: 
    0 4px 0 #7c4a1e,
    0 6px 8px rgba(0,0,0,0.15);
  padding: 10px 32px !important;
  margin: 12px 0;
  font-size: 20px !important;
  position: relative;
  transform: translateY(-2px);
  transition: transform 0.1s, box-shadow 0.1s, background 0.2s;
  text-shadow: 1px 1px 0 #fffbe6;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  overflow: visible;
}

.cuphead-game-btn-2d::before {
  content: "";
  position: absolute;
  left: -6px;
  right: -6px;
  top: -6px;
  bottom: -6px;
  background: transparent;
  border: 2px dashed rgba(166, 124, 82, 0.4);
  border-radius: 22px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.2s;
}

.cuphead-game-btn-2d:hover {
  background: #ffeba0 !important;
  color: #7c4a1e !important;
  transform: translateY(0);
  box-shadow: 
    0 2px 0 #7c4a1e,
    0 4px 6px rgba(0,0,0,0.1);
}

.cuphead-game-btn-2d:hover::before {
  opacity: 1;
}

.cuphead-game-btn-2d:active {
  transform: translateY(2px);
  box-shadow: 
    0 0px 0 #7c4a1e,
    0 2px 4px rgba(0,0,0,0.08);
}

/* 更换头像按钮特殊装饰 */
.cuphead-btn-avatar {
  background: #f5e1a4 !important;
  border-color: #a67c52 !important;
  position: relative;
  padding-left: 48px !important;
}

.cuphead-btn-avatar::after {
  content: "";
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  background: url('/camera-icon.svg') center/contain no-repeat;
  /* 如果没有该图标，可以使用CSS绘制一个相机图标 */
  filter: brightness(0.7) sepia(0.6);
}

/* 退出登录按钮危险风格 */
.cuphead-btn-danger {
  background: #f8d7da !important;
  color: #721c24 !important;
  border-color: #a12312 !important;
  box-shadow: 
    0 4px 0 #a12312,
    0 6px 8px rgba(0,0,0,0.15);
}

.cuphead-btn-danger:hover {
  background: #f1adb2 !important;
  box-shadow: 
    0 2px 0 #a12312,
    0 4px 6px rgba(0,0,0,0.1);
}

/* 添加按钮居中容器与间距 */
.cuphead-btn-center {
  display: flex;
  justify-content: center;
  margin: 18px 0 8px 0;
}

/* 修正按钮focus状态 */
.cuphead-game-btn-2d:focus {
  outline: none;
  box-shadow: 
    0 4px 0 #7c4a1e,
    0 6px 8px rgba(0,0,0,0.15),
    0 0 0 2px rgba(166, 124, 82, 0.3);
}

.cuphead-btn-danger:focus {
  box-shadow: 
    0 4px 0 #a12312,
    0 6px 8px rgba(0,0,0,0.15),
    0 0 0 2px rgba(161, 35, 18, 0.3);
}

/* 确保测距相关元素在测距模式下可见 */
body.measure-active .drawdistance-cursor-tip,
body.measure-active .distance-label,
body.measure-active .delete-btn-overlay {
  visibility: visible !important;
  opacity: 1 !important;
  z-index: 999999 !important;
}

/* 边框特效Canvas样式 */
.particle-border-canvas {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999; /* 位于地图上方，其他控件下方 */
  pointer-events: none; /* 允许点击穿透 */
}
</style>