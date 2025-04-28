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

// 全局事件总线用于跨组件通信
const globalDialogVisible = ref(false);
window.setGlobalDialogVisible = (v) => { globalDialogVisible.value = v; };

const route = useRoute();
const defaultAvatar = 'https://cdn.jsdelivr.net/gh/xiangyuecn/avatardata@main/blank-avatar.png';
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

// 新增：红点提示
const friendTipHasUnread = ref(false);

// 检查是否有未读消息或好友请求
const checkFriendTipUnread = async () => {
  if (!user.value.username) {
    friendTipHasUnread.value = false;
    return;
  }
  // 获取未读消息
  const unreadRes = await axios.get('http://localhost:3001/api/unread-messages', {
    params: { username: user.value.username }
  });
  const unreadMap = unreadRes.data || {};
  // 获取收到的好友请求
  const reqRes = await axios.get('http://localhost:3001/api/received-friend-requests', {
    params: { username: user.value.username }
  });
  const friendReqs = reqRes.data || [];
  // 判断是否有未读消息或好友请求
  friendTipHasUnread.value =
    Object.values(unreadMap).some(v => v > 0) ||
    (Array.isArray(friendReqs) && friendReqs.length > 0);
};

// 刷新好友请求状态
async function refreshPendingRequests() {
  if (!user.value.username) return;
  const [pendingRes, rejectedRes] = await Promise.all([
    axios.get('http://localhost:3001/api/pending-friend-requests', {
      params: { username: user.value.username }
    }),
    axios.get('http://localhost:3001/api/rejected-friend-requests', {
      params: { username: user.value.username }
    })
  ]);
  pendingFriendRequests.value = pendingRes.data || [];
  rejectedFriendRequests.value = rejectedRes.data || [];
}

// 定时轮询刷新
let pendingTimer = null;
let friendTipTimer = null;
onMounted(() => {
  refreshPendingRequests();
  pendingTimer = setInterval(refreshPendingRequests, 1000);
  checkFriendTipUnread();
  friendTipTimer = setInterval(checkFriendTipUnread, 1000);
  window.friendMenuRef = friendMenuRef;
  console.log('[Home.vue] onMounted, Drawdistance ref:', Drawdistance);
});
onBeforeUnmount(() => {
  if (pendingTimer) clearInterval(pendingTimer);
  if (globalMsgTimer) clearInterval(globalMsgTimer);
  if (friendTipTimer) clearInterval(friendTipTimer);
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
  if (globalMsgTimer) clearInterval(globalMsgTimer);
  globalMsgTimer = setInterval(() => {
    if (globalChatDialog.value && messageDialogRef.value?.refresh) {
      messageDialogRef.value.refresh();
    }
  }, 1000);
}
window.openGlobalChatDialog = openGlobalChatDialog;

function handleChatDialogClose() {
  globalChatDialog.value = false;
  if (globalMsgTimer) {
    clearInterval(globalMsgTimer);
    globalMsgTimer = null;
  }
}

// 头像相关
const fetchUserDetail = async () => {
  if (!user.value.username) return;
  const res = await axios.post('http://localhost:3001/api/user-info-batch', {
    usernames: [user.value.username]
  });
  if (Array.isArray(res.data) && res.data.length > 0) {
    user.value.avatar = res.data[0].avatar || '';
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
      const res = await axios.post('http://localhost:3001/api/user-avatar', {
        username: user.value.username,
        avatar: base64
      });
      if (res.data.success) {
        user.value.avatar = base64;
        localStorage.setItem('user', JSON.stringify(user.value));
        avatarUrl.value = base64;
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
const hideSwitchPanel = computed(() => isLoginPage.value || showUserInfo.value || globalDialogVisible.value);

// 打开好友列表方法，兼容PC和移动端
const showFriendList = () => {
  if (friendMenuRef.value) {
    friendMenuRef.value.showFriendList = true;
  }
};

// 兼容PC和移动端，确保弹出好友列表
const handleFriendTip = (e) => {
  console.log('梯形控件响应事件触发:', {
    friendMenuRef: friendMenuRef.value,
    showFriendList: friendMenuRef.value && friendMenuRef.value.showFriendList
  });
  e && e.preventDefault && e.preventDefault();
  if (friendMenuRef.value) {
    if (typeof friendMenuRef.value.showFriendList === 'function') {
      console.log('调用 showFriendList() 方法');
      friendMenuRef.value.showFriendList();
    } else {
      console.log('设置 showFriendList = true');
      friendMenuRef.value.showFriendList = true;
    }
  } else {
    console.log('friendMenuRef.value 未定义');
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
</script>

<template>
  <div class="home-root">
    <!-- 竖直等腰梯形好友入口提示控件，箭头居中 -->
    <div
      class="friend-tip-vertical-trapezoid"
      @mouseenter="handleFriendTip"
      @touchstart="handleFriendTip"
      @click="handleFriendTip"
      title="点击或触摸打开好友列表"
    >
      <div class="friend-tip-arrow-content">
        <svg class="friend-tip-arrow" width="24" height="48" viewBox="0 0 24 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="20,8 20,40 6,24" fill="#409eff"/>
        </svg>
        <span
          v-if="friendTipHasUnread"
          class="friend-tip-unread-dot"
          title="有新消息或好友请求"
        ></span>
      </div>
    </div>
    <FriendMenu ref="friendMenuRef" @open-chat="openGlobalChatDialog" />
    <Map class="map-bg" />
    <Header class="header-fixed"/>
    <!-- 用户头像控件，右上角 -->
    <div
      class="user-avatar"
      @click="onUserAvatarClick"
      :style="{ pointerEvents: isLoginPage ? 'none' : 'auto', zIndex: 4000 }"
    >
      <el-avatar :size="44" :src="avatarUrl" />
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
        <Drawdistance @mounted="() => console.log('[Home.vue] Drawdistance mounted')" />
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
  top: 10px;
  right: 40px;
  z-index: 4000;
  width: 44px;
  height: 44px;
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
/* 竖直等腰梯形控件样式 */
.friend-tip-vertical-trapezoid {
  position: fixed;
  left: 0;
  top: 50%;
  z-index: 5001;
  width: 48px;
  height: 120px;
  background: #fff;
  color: #409eff;
  cursor: pointer;
  user-select: none;
  border: 1px solid #e5e6eb;
  box-shadow: 0 2px 8px rgba(0,0,0,0.10);
  clip-path: polygon(0 0, 100% 12px, 100% calc(100% - 12px), 0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.2s, background 0.2s;
  transform: translateY(-50%);
  background-clip: padding-box;
}
.friend-tip-vertical-trapezoid:hover {
  background: #f0f7ff;
  box-shadow: 0 4px 16px rgba(64,158,255,0.12);
}
.friend-tip-arrow-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.friend-tip-arrow {
  display: block;
  margin: 0 auto;
}
.friend-tip-unread-dot {
  position: absolute;
  top: 10px;
  right: 8px;
  width: 13px;
  height: 13px;
  background: #f56c6c;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 4px #f56c6c;
  z-index: 2;
  pointer-events: none;
}
@media (max-width: 600px) {
  .friend-tip-vertical-trapezoid {
    height: 80px;
    width: 36px;
  }
  .friend-tip-arrow {
    width: 18px;
    height: 32px;
  }
  .friend-tip-unread-dot {
    width: 10px;
    height: 10px;
    top: 6px;
    right: 4px;
  }
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