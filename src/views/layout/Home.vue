<script setup>
import Header from './Header.vue';
import Switch from './switch.vue';
import Map from '../Map.vue';
import PublicMap from '../dataService/PublicMap.vue';
import FriendMenu from './friendmenu.vue';
import MessageDialog from './MessageDialog.vue';
/*import Drawdistance from '../graDraw/Drawdistance.vue';*/
import Drawdistance from '../graDraw/Drawdistance.vue';
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { useRoute } from 'vue-router';
import { useSocket } from '@/utils/usesocket'; // 新增

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
  );
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
  // 初始化socket监听红点（只刷新红点，不刷新地图等其他内容）
  nextTick(() => {
    // 兼容 socket 初始化时机
    let tryBindSocket = () => {
      if (window.friendMenuRef?.value?.socket) {
        setupHomeSocketFriendTip(window.friendMenuRef.value.socket);
      } else {
        setTimeout(tryBindSocket, 200);
      }
    };
    tryBindSocket();
  });
  // 但主界面红点依赖的是 setupFriendListEventSocket
  // 应该确保 setupFriendListEventSocket 也被绑定
  if (window.friendMenuRef?.value?.socket && !window.friendMenuRef.value._setupFriendListEventSocket) {
    setupFriendListEventSocket(window.friendMenuRef.value.socket);
    window.friendMenuRef.value._setupFriendListEventSocket = true;
  }
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
  if (typeof window !== 'undefined' && typeof window.setGlobalDialogVisible === 'function') {
    window.setGlobalDialogVisible(true);
  }
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
const hideSwitchPanel = computed(() => isLoginPage.value || isRegisterPage.value || showUserInfo.value || globalDialogVisible.value);

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
  }
}

// 新增：好友菜单是否展开
const friendMenuVisible = computed(() => {
  return !!(friendMenuRef.value && friendMenuRef.value.showFriendList);
});

// 新增：socket监听未读消息和好友请求，动态控制红点
function setupSocketFriendTip(socket) {
  // 监听未读消息
  socket.value.on('unread-updated', (data) => {
    checkFriendTipUnread(data, lastFriendReqs);
  });
  // 监听好友请求
  socket.value.on('pending-requests-updated', async () => {
    const res = await axios.get('/api/received-friend-requests', {
      params: { username: user.value.username }
    });
    checkFriendTipUnread(lastUnreadMap, res.data || []);
  });
}

// 页面初始化时拉取一次未读消息和好友请求，保证红点初始状态正确
onMounted(async () => {
  await fetchFriendListEventsUnread();
  nextTick(() => {
    if (friendMenuRef.value && friendMenuRef.value.socket && !friendMenuRef.value._setupFriendListEventSocket) {
      setupFriendListEventSocket(friendMenuRef.value.socket);
      friendMenuRef.value._setupFriendListEventSocket = true;
    }
  });
});

// 头像加载失败回调，防止未定义警告
function onAvatarError(e) {
  avatarUrl.value = defaultAvatar;
}

const mapReady = ref(false); // 修复 mapReady 未定义
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
    <Header class="header-fixed"/>
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
      title="个人信息"
      width="320px"
      :close-on-click-modal="true"
      :modal="true"
      append-to-body
      class="user-info-dialog"
      :z-index="4100"
      @open="onUserInfoDialogOpen"
      @close="handleDialogClose"
      :close-on-press-escape="true"
      :show-close="true"
    >
      <template #header="{ close }">
        <span>个人信息</span>
        <el-button
          class="el-dialog__headerbtn"
          aria-label="Close"
          @click="close"
          style="float:right;"
        >
          <i class="el-dialog__close el-icon el-icon-close"></i>
        </el-button>
      </template>
      <div style="text-align:center;">
        <el-avatar :size="80" :src="avatarUrl" style="margin-bottom: 16px;" />
        <div style="margin:16px 0;">账号：{{ user.username }}</div>
        <div style="margin:10px 0;">
          <el-button
            type="primary"
            :loading="uploading"
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
        <!-- 发送好友请求按钮 -->
        <el-button
          type="success"
          v-if="selectedUser && user.username !== selectedUser.username"
          :disabled="isPending"
          @click="friendMenuRef.value?.sendFriendRequest(selectedUser.value.username)"
        >
          {{ isPending ? '交友请求已发送' : '发送好友请求' }}
        </el-button>
        <span v-if="isRejected" style="color:#f56c6c;font-size:13px;margin-left:8px;">对方已拒绝，请重新发送</span>
        <el-button type="danger" @click="logout">退出登录</el-button>
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
        <!-- 只在地图初始化后再挂载测距控件 -->
        <Drawdistance v-if="mapReady" @mounted="() => console.log('[Home.vue] Drawdistance mounted')" />
      </div>
    </div>
    <!-- 右下角控件组合：仅在非登录页且未显示任何弹窗时可见 -->
    <div
      class="switch-bottom-panel"
      v-if="!hideSwitchPanel"
      :style="{ pointerEvents: !hideSwitchPanel ? 'auto' : 'none' }"
    >
      <Switch />
    </div>
  </div>
</template>

<style scoped>
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
.header-fixed {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  z-index: 10;
}
.layout-content {
  position: absolute;
  left: 0;
  top: 36px; /* Header高度 */
  width: 100vw;
  height: calc(100vh - 36px);
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
</style>