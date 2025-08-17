<template>
  <div
    class="friend-list-sidebar"
    :class="{ show: showFriendList }"
    @mouseenter="handleFriendListEnter"
    @mouseleave="handleFriendListLeave"
  >
    <div class="friend-list-title">
      好友列表
      <el-button class="add-friend-btn" type="primary" circle size="small" @click.stop="showAddFriendDialog = true" title="添加好友">
        <span style="font-size:20px;">+</span>
      </el-button>
    </div>
    <el-scrollbar style="height:calc(100vh - 60px);">
      <el-skeleton v-if="loadingFriends" :rows="6" animated />
      <div v-else>
        <div v-if="friends.length === 0 && friendRequests.length === 0" class="friend-list-empty">暂无好友</div>
        <!-- 新UI：收到的好友请求 -->
        <div
          v-for="req in friendRequests"
          :key="'req-' + req.from"
          class="friend-list-item friend-request-item"
        >
          <el-avatar :size="36" :src="req.avatar || defaultAvatar" />
          <span class="friend-list-name">{{ req.from }}</span>
          <div class="friend-request-vertical-actions">
            <div class="action-accept" @click="handleRequest(req.from, true)" title="同意"></div>
            <div class="action-reject" @click="handleRequest(req.from, false)" title="拒绝"></div>
          </div>
        </div>
        <div
          v-for="f in friends"
          :key="f.username"
          class="friend-list-item"
          @click="handleFriendClick(f)"
          @contextmenu.prevent.stop="onFriendContextMenu($event, f)"
          ref="friendItemRefs"
        >
          <el-avatar :size="36" :src="f.avatar || defaultAvatar" />
          <span class="friend-list-name">{{ f.username }}</span>
          <span
            v-if="unreadMap[f.username] > 0"
            class="friend-unread-dot"
            title="有新消息"
          ></span>
        </div>
      </div>
    </el-scrollbar>
    <!-- 修改：添加好友弹窗放大并居中，搜索结果横向排列 -->
    <el-dialog
      v-model="showAddFriendDialog"
      title="添加好友"
      width="420px"
      append-to-body
      align-center
      class="add-friend-dialog-center"
      :modal="true"
      :close-on-click-modal="true"
    >
      <!-- 新增：整体居中 -->
      <div class="add-friend-dialog-center-content">
        <el-input
          v-model="searchName"
          placeholder="输入用户名搜索"
          clearable
          @keyup.enter="searchUser"
          style="margin-bottom: 16px;"
        />
        <el-button type="primary" @click="searchUser" style="margin-bottom: 18px;">搜索</el-button>
        <div v-if="searchResult !== null">
          <div v-if="searchResult && searchResult.username" class="search-user-row">
            <el-avatar :size="48" :src="searchResult.avatar || defaultAvatar" />
            <span class="search-user-name">{{ searchResult.username }}</span>
            <el-button
              type="success"
              size="small"
              class="search-user-add-btn"
              :disabled="searchResult.username === user.username || isFriend(searchResult.username) || isPending(searchResult.username)"
              @click="addFriendBySearch(searchResult.username)"
            >
              <template v-if="searchResult.username === user.username">自己</template>
              <template v-else-if="isFriend(searchResult.username)">已是好友</template>
              <template v-else-if="isPending(searchResult.username)">已发送请求</template>
              <template v-else>添加</template>
            </el-button>
          </div>
          <div v-else style="color:#f56c6c;text-align:center;">未找到该用户</div>
        </div>
      </div>
    </el-dialog>
    <!-- 全局右键菜单 popover，只渲染一次 -->
    <el-popover
      v-if="contextMenu.visible && contextMenu.friend"
      :visible="contextMenu.visible"
      :virtual-ref="contextMenu.virtualRef"
      virtual-triggering
      placement="bottom-start"
      width="160"
      @after-leave="onContextMenuAfterLeave"
      append-to-body
      popper-class="friend-context-popover"
    >
      <div class="context-menu-list">
        <div class="context-menu-item" @click="clearChatHistory(contextMenu.friend)">清空聊天记录</div>
        <div class="context-menu-item context-menu-item-danger" @click="deleteFriend(contextMenu.friend)">删除好友</div>
        <div class="context-menu-item context-menu-item-cancel" @click="closeContextMenu">取消</div>
      </div>
    </el-popover>
  </div>
  <div class="friend-list-hover-area" @mouseenter="handleFriendListEnter"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose, nextTick, onUnmounted } from 'vue'
import axios from 'axios'
import { useSocket } from '@/utils/usesocket'  // 请确保此模块已创建

// 修改：默认头像使用本地 public 目录下的 blank-avatar.png
const defaultAvatar = '/blank-avatar.png';
const showFriendList = ref(false);
const friends = ref([]);
const loadingFriends = ref(false);
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const emit = defineEmits(['open-chat']);
const unreadMap = ref({});
const friendRequests = ref([]);
const friendItemRefs = ref([]);
const backendOrigin = 'https://kexiaohua.online'; // 后端部署域名

// 工具函数：补全头像URL为后端绝对路径
function fixAvatarUrl(avatar) {
  if (!avatar) return defaultAvatar;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  if (avatar.startsWith('/avatars/')) return backendOrigin + avatar;
  return avatar;
}

// 原有的请求函数保持不变
const fetchFriends = async () => {
  loadingFriends.value = true;
  try {
    const res = await axios.get('/api/user-friends', {
      params: { username: user.value.username }
    });
    const friendNames = (res.data || []).map(f => typeof f === 'string' ? f : (f.username || f));
    if (friendNames.length === 0) {
      friends.value = [];
    } else {
      const res2 = await axios.post('/api/user-info-batch', {
        usernames: friendNames
      });
      // 修正：补全头像URL为后端绝对路径（优先缩略图）
      friends.value = (res2.data || []).map(u => ({
        username: u.username,
        avatar: fixAvatarUrl(u.avatar)
      }));
    }
  } finally {
    loadingFriends.value = false;
  }
};

const fetchUnread = async () => {
  const res = await axios.get('/api/unread-messages', {
    params: { username: user.value.username }
  });
  unreadMap.value = res.data || {};
};

const fetchFriendRequests = async () => {
  const res = await axios.get('/api/received-friend-requests', {
    params: { username: user.value.username }
  });
  // 修正：补全头像URL为后端绝对路径
  friendRequests.value = (res.data || []).map(req => ({
    ...req,
    avatar: fixAvatarUrl(req.avatar)
  }));
};

const handleRequest = async (from, accept) => {
  await axios.post('/api/handle-friend-request', {
    username: user.value.username,
    from,
    accept
  });
  await fetchFriends();
  await fetchFriendRequests();
  window.refreshPendingRequests && window.refreshPendingRequests();
  // 新增：操作后清除好友列表变化未读
  await clearFriendListEvents();
};

const sendFriendRequest = async (toUsername) => {
  if (!user.value.username || !toUsername) return;
  try {
    const res = await axios.post('/api/friend-request', {
      from: user.value.username,
      to: toUsername
    });
    window.ElMessage && window.ElMessage.success('好友请求已发送');
    window.refreshPendingRequests && window.refreshPendingRequests();
    // 新增：操作后清除好友列表变化未读
    await clearFriendListEvents();
  } catch (err) {
    window.ElMessage && window.ElMessage.error('发送好友请求失败');
  }
};

const handleFriendListEnter = () => {
  showFriendList.value = true;
  if (friends.value.length === 0 && user.value.username) {
    fetchFriends();
  }
};

const handleFriendListLeave = () => {
  // 只有未锁定时才允许关闭好友列表
  if (!contextMenuLock.value) {
    showFriendList.value = false;
  }
};

const handleFriendClick = (f) => {
  if (window.openGlobalChatDialog) {
    window.openGlobalChatDialog(f);
  } else {
    emit('open-chat', f);
  }
  unreadMap.value[f.username] = 0;
};

// 新增：添加好友弹窗相关
const showAddFriendDialog = ref(false)
const searchName = ref('')
const searchResult = ref(null)
const pendingFriendRequests = ref([]) // 用于判断是否已发送请求

// 判断是否已是好友
function isFriend(username) {
  return friends.value.some(f => (typeof f === 'string' ? f : f.username) === username)
}
// 判断是否已发送请求
function isPending(username) {
  return pendingFriendRequests.value.includes(username)
}

// 搜索用户
const searchUser = async () => {
  searchResult.value = null
  if (!searchName.value) return
  // 查询后端数据库
  const res = await axios.post('/api/user-info-batch', { usernames: [searchName.value] })
  if (Array.isArray(res.data) && res.data.length > 0) {
    // 修正：补全头像URL为后端绝对路径
    const userObj = res.data[0]
    userObj.avatar = fixAvatarUrl(userObj.avatar)
    searchResult.value = userObj
  } else {
    searchResult.value = {}
  }
}

// 添加好友（通过搜索结果）
const addFriendBySearch = async (toUsername) => {
  if (!user.value.username || !toUsername) return
  await sendFriendRequest(toUsername)
  pendingFriendRequests.value.push(toUsername)
}

// 获取自己发出的未处理好友请求
const fetchPendingFriendRequests = async () => {
  if (!user.value.username) return
  const res = await axios.get('/api/pending-friend-requests', {
    params: { username: user.value.username }
  })
  pendingFriendRequests.value = res.data || []
}

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  friend: null,
  virtualRef: null
});

// 锁定好友列表弹窗
const contextMenuLock = ref(false);

// 右键事件
function onFriendContextMenu(e, friend) {
  // 锁定好友列表弹窗
  contextMenuLock.value = true;
  contextMenu.value.visible = false;
  contextMenu.value.friend = null;
  contextMenu.value.virtualRef = null;
  nextTick(() => {
    contextMenu.value.friend = friend;
    contextMenu.value.virtualRef = {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        top: e.clientY,
        left: e.clientX,
        right: e.clientX,
        bottom: e.clientY
      }),
      clientWidth: 0,
      clientHeight: 0
    };
    nextTick(() => {
      contextMenu.value.visible = true;
      // 添加全局点击监听，点击空白处关闭菜单
      document.addEventListener('mousedown', onGlobalClick, true);
    });
  });
}

// 关闭右键菜单
function closeContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.friend = null;
  contextMenu.value.virtualRef = null;
  // 解除锁定
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
}

// 右键菜单关闭后回调
function onContextMenuAfterLeave() {
  // 解除锁定
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
}

// 全局点击关闭右键菜单（只要不是在菜单内点击）
function onGlobalClick(e) {
  // 判断点击是否在弹窗内
  const popover = document.querySelector('.friend-context-popover');
  if (popover && popover.contains(e.target)) return;
  closeContextMenu();
}

// 清空聊天记录
async function clearChatHistory(friend) {
  contextMenu.value.visible = false;
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
  if (!user.value.username || !friend?.username) return;
  await axios.post('/api/clear-chat-history', {
    user1: user.value.username,
    user2: friend.username
  });
  window.ElMessage && window.ElMessage.success('聊天记录已清空');
}

// 删除好友
async function deleteFriend(friend) {
  contextMenu.value.visible = false;
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
  if (!user.value.username || !friend?.username) return;
  await axios.post('/api/delete-friend', {
    user1: user.value.username,
    user2: friend.username
  });
  window.ElMessage && window.ElMessage.success('好友已删除');
  await fetchFriends();
  if (window.friendMenuRef?.value?.fetchFriends) {
    window.friendMenuRef.value.fetchFriends();
  }
  // 新增：操作后清除好友列表变化未读
  await clearFriendListEvents();
}

// 新增：清除好友列表变化未读
async function clearFriendListEvents() {
  if (!user.value.username) return;
  await axios.post('/api/friend-list-events/read', { username: user.value.username });
}

// 组件卸载时移除全局事件监听
onUnmounted(() => {
  document.removeEventListener('mousedown', onGlobalClick, true);
});

onMounted(async () => {
  // 初次加载数据
  await fetchFriends();
  await fetchUnread();
  await fetchFriendRequests();
  await fetchPendingFriendRequests()

  // 不再使用轮询（已删除如下代码）：
  // unreadTimer = setInterval(fetchUnread, 1000)
  // friendReqTimer = setInterval(fetchFriendRequests, 1000)

  // 初始化 WebSocket 连接，并加入房间
  const { socket, joinRoom } = useSocket();
  if (user.value.username) {
    joinRoom(user.value.username);
  }

  // 实时监听未读消息变化，及时刷新红点
  socket.value.on('unread-updated', (data) => {
    unreadMap.value = data || {};
  });

  // 实时监听好友请求变化，及时刷新好友请求和红点
  socket.value.on('pending-requests-updated', () => {
    fetchFriendRequests();
  });

  // 实时监听好友列表变化，及时刷新好友列表
  socket.value.on('friend-list-updated', () => {
    fetchFriends();
  });

  // 新增：监听收到新聊天消息时刷新未读
  socket.value.on('chat-message', (msg) => {
    // 只处理发给自己的消息
    if (msg && msg.to === user.value.username) {
      fetchUnread();
    }
  });

  // 新增：监听被删除好友通知
  socket.value.on('friend-removed-notice', (data) => {
    window.ElMessage && window.ElMessage.warning(`你已被 ${data.from} 移除好友`);
    fetchFriends();
  });
});

onBeforeUnmount(() => {
  // 如果你的全局 socket 在整个 App 生命周期都需要，无须在此断开连接，
  // 如果需要局部断开，可以解除事件监听:
  // socket.value.off('unread-updated');
  // socket.value.off('new-friend-request');
  // socket.value.off('friend-list-updated');
});

// 暴露部分方法给父组件使用
defineExpose({
  sendFriendRequest,
  fetchFriends,
  showFriendList
});
</script>

<style scoped>
.friend-list-sidebar {
  position: fixed;
  top: 0;
  left: -220px;
  width: 220px;
  height: 100vh;
  background: #fff;
  box-shadow: 2px 0 8px rgba(0,0,0,0.08);
  z-index: 5000;
  transition: left 0.25s cubic-bezier(.4,0,.2,1);
  border-right: 1px solid #e5e6eb;
  display: flex;
  flex-direction: column;
  pointer-events: auto;
}
.friend-list-sidebar.show {
  left: 0;
}
.friend-list-title {
  font-size: 18px;
  font-weight: bold;
  padding: 18px 0 12px 24px;
  border-bottom: 1px solid #f0f0f0;
  background: #f8f8f8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.add-friend-btn {
  margin-left: auto;
  margin-right: 16px;
  padding: 0;
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.friend-list-empty {
  color: #aaa;
  text-align: center;
  margin-top: 40px;
}
.friend-list-item {
  display: flex;
  align-items: center;
  padding: 12px 18px;
  border-bottom: 1px solid #f5f5f5;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;
}
.friend-list-item:hover {
  background: #f5f7fa;
}
.friend-list-name {
  margin-left: 12px;
  font-size: 16px;
  color: #333;
  word-break: break-all;
  flex: 1;
}
.friend-unread-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  background: #f56c6c;
  border-radius: 50%;
  margin-left: 8px;
  margin-top: 2px;
}
.friend-list-hover-area {
  position: fixed;
  top: 0;
  left: 0;
  width: 8px;
  height: 100vh;
  z-index: 4999;
  background: transparent;
  pointer-events: auto;
}
.friend-request-item {
  background: #fffbe6;
  border-left: 4px solid #f56c6c;
  position: relative;
}
.friend-request-vertical-actions {
  width: 20%;
  min-width: 32px;
  height: 36px;
  display: flex;
  flex-direction: column;
  justify-content: stretch;
  align-items: stretch;
  margin-left: 8px;
  position: absolute;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
}
.action-accept,
.action-reject {
  flex: 1;
  width: 100%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  user-select: none;
}
.action-accept {
  background: #67c23a;
  border-radius: 4px 4px 0 0;
  color: #fff;
  border-bottom: 1px solid #fff;
  position: relative;
}
.action-accept::after {
  content: '';
  display: inline-block;
  width: 14px;
  height: 14px;
  background: url('data:image/svg+xml;utf8,<svg fill="white" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M426.666667 725.333333l-213.333334-213.333333 60.586667-60.586667 152.746667 152.746667 322.346667-322.346667 60.586666 60.586667z"/></svg>') no-repeat center center;
  background-size: 14px 14px;
}
.action-reject {
  background: #f56c6c;
  border-radius: 0 0 4px 4px;
  color: #fff;
  border-top: 1px solid #fff;
  position: relative;
}
.action-reject::after {
  content: '';
  display: inline-block;
  width: 14px;
  height: 14px;
  background: url('data:image/svg+xml;utf8,<svg fill="white" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M195.2 195.2a32 32 0 0 1 45.248 0L512 466.752l271.552-271.552a32 32 0 1 1 45.248 45.248L557.248 512l271.552 271.552a32 32 0 1 1-45.248 45.248L512 557.248l-271.552 271.552a32 32 0 1 1-45.248-45.248L466.752 512 195.2 240.448a32 32 0 0 1 0-45.248z"/></svg>') no-repeat center center;
  background-size: 14px 14px;
}

/* 新增：添加好友弹窗居中放大 */
.add-friend-dialog-center :deep(.el-dialog) {
  top: 50% !important;
  left: 50% !important;
  transform: translate(-50%, -50%) !important;
  min-width: 420px;
  max-width: 90vw;
}
.add-friend-dialog-center :deep(.el-dialog__body) {
  padding-top: 18px;
  padding-bottom: 18px;
}

/* 新增：搜索结果横向排列并居中对齐 */
.search-user-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 18px;
  margin-top: 10px;
  margin-bottom: 8px;
}
.search-user-name {
  font-size: 18px;
  font-weight: 500;
  color: #333;
  margin-left: 6px;
  margin-right: 6px;
  min-width: 80px;
  text-align: left;
  display: inline-block;
}
.search-user-add-btn {
  margin-left: 8px;
  min-width: 80px;
}

/* 新增：添加好友弹窗内容整体居中 */
.add-friend-dialog-center-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* 右键菜单样式微调 */
:deep(.el-dropdown-menu) {
  min-width: 120px;
}

/* 右键菜单样式 */
.context-menu-list {
  display: flex;
  flex-direction: column;
  min-width: 120px;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  padding: 4px 0;
  font-size: 15px;
}
.context-menu-item {
  padding: 8px 18px;
  cursor: pointer;
  color: #333;
  transition: background 0.15s;
  user-select: none;
  text-align: center; /* 新增：文本居中 */
}
.context-menu-item:hover {
  background: #f5f7fa;
}
.context-menu-item-danger {
  color: #f56c6c;
  border-top: 1px solid #f0f0f0;
  margin-top: 2px;
}
.context-menu-item-cancel {
  color: #888;
  border-top: 1px solid #f0f0f0;
  margin-top: 2px;
  text-align: center;
}
.friend-context-popover {
  padding: 0 !important;
  min-width: 120px !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important;
  border-radius: 6px !important;
}
</style>
  border-radius: 6px !important;
}
</style>
