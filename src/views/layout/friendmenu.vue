<template>
  <div
    class="friend-list-sidebar"
    :class="{ show: showFriendList }"
    @mouseenter="handleFriendListEnter"
    @mouseleave="handleFriendListLeave"
  >
    <div class="friend-list-title">好友列表</div>
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
  </div>
  <div class="friend-list-hover-area" @mouseenter="handleFriendListEnter"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose } from 'vue'
import axios from 'axios'
import { useSocket } from '@/utils/usesocket'  // 请确保此模块已创建

const defaultAvatar = 'https://cdn.jsdelivr.net/gh/xiangyuecn/avatardata@main/blank-avatar.png';
const showFriendList = ref(false);
const friends = ref([]);
const loadingFriends = ref(false);
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const emit = defineEmits(['open-chat']);
const unreadMap = ref({});
const friendRequests = ref([]);

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
      friends.value = res2.data || [];
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
  friendRequests.value = res.data || [];
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
};

const sendFriendRequest = async (toUsername) => {
  if (!user.value.username || !toUsername) return;
  console.log('sendFriendRequest called:', user.value.username, '->', toUsername);
  try {
    const res = await axios.post('/api/friend-request', {
      from: user.value.username,
      to: toUsername
    });
    console.log('sendFriendRequest axios result:', res && res.data);
    window.ElMessage && window.ElMessage.success('好友请求已发送');
    window.refreshPendingRequests && window.refreshPendingRequests();
  } catch (err) {
    console.error('sendFriendRequest error:', err);
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
  showFriendList.value = false;
};

const handleFriendClick = (f) => {
  console.log('FriendMenu.vue handleFriendClick', f);
  if (window.openGlobalChatDialog) {
    window.openGlobalChatDialog(f);
  } else {
    emit('open-chat', f);
  }
  unreadMap.value[f.username] = 0;
};

onMounted(async () => {
  console.log('FriendMenu.vue onMounted');
  // 初次加载数据
  await fetchFriends();
  await fetchUnread();
  await fetchFriendRequests();

  // 不再使用轮询（已删除如下代码）：
  // unreadTimer = setInterval(fetchUnread, 1000)
  // friendReqTimer = setInterval(fetchFriendRequests, 1000)

  // 初始化 WebSocket 连接，并加入房间
  const { socket, joinRoom } = useSocket();
  if (user.value.username) {
    joinRoom(user.value.username);
  }

  // 监听服务器推送的事件更新数据，无需轮询
  socket.value.on('unread-updated', (data) => {
    console.log("收到未读消息更新", data);
    unreadMap.value = data;
  });
  socket.value.on('pending-requests-updated', (data) => {
    console.log("收到新的好友请求", data);
    // 这里可以直接更新 friendRequests，也可以调用 fetchFriendRequests() 再次获取数据
    fetchFriendRequests();
  });
  socket.value.on('friend-list-updated', () => {
    console.log("收到好友列表更新");
    fetchFriends();
  });
});

onBeforeUnmount(() => {
  // 如果你的全局 socket 在整个 App 生命周期都需要，无须在此断开连接，
  // 如果需要局部断开，可以解除事件监听:
  // socket.value.off('unread-updated');
  // socket.value.off('new-friend-request');
  // socket.value.off('friend-list-updated');
  console.log('FriendMenu.vue onBeforeUnmount');
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
</style>
