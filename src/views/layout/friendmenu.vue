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
    <!-- 只保留棕色发光圆角框弹窗，绝对定位模拟弹窗位置 -->
    <div
      v-if="contextMenu.visible && contextMenu.friend && contextMenu.virtualRef"
      class="friend-context-popover"
      :style="{
        position: 'fixed',
        left: contextMenu.virtualRef.getBoundingClientRect().left + 'px',
        top: contextMenu.virtualRef.getBoundingClientRect().top + 'px',
        zIndex: 6000
      }"
    >
      <div class="context-menu-list">
        <div class="context-menu-item" @click="clearChatHistory(contextMenu.friend)">清空聊天记录</div>
        <div class="context-menu-item context-menu-item-danger" @click="deleteFriend(contextMenu.friend)">删除好友</div>
        <div class="context-menu-item context-menu-item-cancel" @click="closeContextMenu">取消</div>
      </div>
    </div>
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
@font-face {
  font-family: 'JiangxiZhuokai';
  src: url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff2') format('woff2'),
       url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff') format('woff');
  font-display: swap;
}

/* 好友列表整体风格，普通边框 */
.friend-list-sidebar {
  position: fixed;
  top: 0;
  left: -240px;
  width: 240px;
  height: 100vh;
  background: url('/friendlistbackground.jpg') center center/cover no-repeat;
  box-shadow: none;
  border: 2px solid #a67c52;
  z-index: 5000;
  transition: left 0.25s cubic-bezier(.4,0,.2,1);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  filter: contrast(1.05) brightness(1.03);
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}
.friend-list-sidebar.show {
  left: 0;
}

/* 标题分割线：柔和弯曲效果 */
.friend-list-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 22px;
  font-weight: bold;
  padding: 24px 0 12px 32px;
  background: transparent;
  color: #7c4a1e;
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 #f5e1a4, 0 2px 8px #a67c52;
  border-bottom: 0;
  position: relative;
}
.friend-list-title::after {
  content: "";
  display: block;
  width: 85%;
  height: 0;
  margin: 12px auto 0 auto;
  border-bottom: 2px solid #e7cfa2;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 2px 8px rgba(166,124,82,0.08);
  opacity: 0.7;
}

/* 好友项分割线：手绘感，略带弯曲 */
.friend-list-item {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  color: #7c4a1e;
  background: transparent;
  padding: 16px 24px;
  border-bottom: 0;
  position: relative;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  /* 保证横向排列 */
  flex-direction: row;
}
.friend-list-item:not(:last-child)::after {
  content: "";
  display: block;
  width: 90%;
  height: 0;
  margin: 10px auto 0 auto;
  border-bottom: 2px solid #e7cfa2;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 1px 6px rgba(166,124,82,0.06);
  opacity: 0.6;
}

/* 鼠标悬停时变深色，字体变浅色，头像高亮 */
.friend-list-item:hover {
  background: #a67c52;
  color: #fff;
  transition: background 0.2s, color 0.2s;
}
.friend-list-item:hover .friend-list-name {
  color: #fff;
  text-shadow: none;
}
.friend-list-item:hover .el-avatar {
  box-shadow: 0 0 8px #fff, 0 2px 8px rgba(0,0,0,0.10);
  border: 2px solid #fff;
}

/* 好友名称与头像垂直居中对齐 */
.friend-list-name {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  color: #7c4a1e;
  margin-left: 12px;
  margin-top: 0;
  line-height: 36px;
  /* 修正：保证名称横向显示，不换行 */
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 删除 word-break: break-all; */
  text-shadow: 1px 1px 0 #f5e1a4;
}
.friend-unread-dot {
  display: inline-block;
  width: 13px;
  height: 13px;
  background: #a67c52;
  border-radius: 50%;
  margin-left: 8px;
  margin-top: 2px;
  border: 2px solid #f5e1a4;
  box-shadow: 0 0 4px #a67c52;
}
.add-friend-btn {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  background: #f5e1a4;
  color: #7c4a1e;
  border: 2px solid #a67c52;
  border-radius: 12px;
  box-shadow: 2px 2px 0 #a67c52;
  font-size: 22px;
  padding: 0 8px;
  min-width: 32px;
  min-height: 32px;
  transition: background 0.2s;
}
.add-friend-btn:hover {
  background: #a67c52;
  color: #f5e1a4;
}
.friend-request-item {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  background: rgba(253, 246, 227, 0.8);
  border-left: 6px solid #a67c52;
  position: relative;
}
.context-menu-list {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  background: var(--cup-bg-gradient);
  border-radius: 12px;
  box-shadow: 0 2px 8px #a67c52;
  padding: 8px 0;
  font-size: 16px;
  color: #7c4a1e;
  border: 2px solid #a67c52;
}
.context-menu-item {
  padding: 10px 24px;
  cursor: pointer;
  color: #7c4a1e;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
  user-select: none;
  text-align: center;
  border-bottom: none;
  border-radius: 8px;
}
.context-menu-item:hover {
  background: #a67c52;
  color: #fff;
  box-shadow: 0 0 8px #a67c52, 0 2px 8px rgba(0,0,0,0.10);
  text-shadow: none;
}
.context-menu-item-danger {
  color: #a67c52;
}
.context-menu-item-cancel {
  color: #888;
  text-align: center;
}
</style>


